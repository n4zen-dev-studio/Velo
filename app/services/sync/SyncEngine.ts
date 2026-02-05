import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryFirst } from "@/services/db/queries"
import {
  listPendingOps,
  markOpsSent,
  markOpFailed,
  pruneSentOps,
} from "@/services/db/repositories/changeLogRepository"
import {
  getTaskById,
  markTaskDeletedFromSync,
  upsertTaskFromSync,
} from "@/services/db/repositories/tasksRepository"
import {
  getCommentById,
  markCommentDeletedFromSync,
  upsertCommentFromSync,
} from "@/services/db/repositories/commentsRepository"
import {
  markUserDeletedFromSync,
  upsertUserFromSync,
} from "@/services/db/repositories/usersRepository"
import {
  markWorkspaceMemberDeletedFromSync,
  upsertWorkspaceMemberFromSync,
} from "@/services/db/repositories/workspaceMembersRepository"
import type { ChangeLogEntry, Comment, Task } from "@/services/db/types"
import { createHttpClient } from "@/services/api/httpClient"
import { sync as syncApi } from "@/services/api/syncApi"
import type { SyncChange, SyncRequest } from "@/services/sync/syncContract"
import { getDeviceId } from "@/services/sync/identity"
import { getActiveScopeKey } from "@/services/session/scope"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { BASE_URL } from "@/config/api"
import { delay } from "@/utils/delay"
import { personalWorkspaceId } from "@/services/db/repositories/workspacesRepository"
import { ANON_USER_ID } from "@/services/constants/identity"

const MAX_OPS_PER_BATCH = 50
const MAX_BATCHES = 5
const MAX_CHANGES_PER_RUN = 500
let isSyncRunning = false
let consecutiveFailures = 0

export async function runSync(reason?: string) {
  if (isSyncRunning) return
  isSyncRunning = true
  const db = await getDb()
  const scopeKey = await getActiveScopeKey()

  try {
    const cursorRow = await queryFirst<{ lastCursor: string | null }>(
      db,
      "SELECT lastCursor FROM sync_state WHERE scopeKey = ?",
      [scopeKey],
    )

    const deviceId = await getDeviceId()
    const client = createHttpClient(BASE_URL)
    let batches = 0
    let cursor = cursorRow?.lastCursor ?? null

    let appliedChanges = 0
    while (batches < MAX_BATCHES) {
      const ops = await listPendingOps(MAX_OPS_PER_BATCH, scopeKey)
      if (ops.length === 0 && batches > 0) break

      const payload: SyncRequest = {
        cursor,
        deviceId,
        ops: ops.map(mapChangeLogToOp),
      }

      let response
      try {
        response = await syncApi(client, payload)
        consecutiveFailures = 0
      } catch (error) {
        consecutiveFailures += 1
        await delay(getBackoffMs(consecutiveFailures))
        throw error
      }

      await executeTransaction(db, async (txDb) => {
        if (response.ackOpIds.length > 0) {
          await markOpsSent(response.ackOpIds, txDb)
        }
        for (const failed of response.failed ?? []) {
          await markOpFailed(failed.opId, failed.message, txDb)
        }

        const remaining = Math.max(0, MAX_CHANGES_PER_RUN - appliedChanges)
        const changesToApply = response.changes.slice(0, remaining)
        for (const change of changesToApply) {
          await applyRemoteChange(txDb, change)
        }
        appliedChanges += changesToApply.length

        const newCursor = response.newCursor ?? cursor
        await execute(
          txDb,
          `INSERT INTO sync_state (scopeKey, lastCursor, lastSyncedAt)
           VALUES (?, ?, ?)
           ON CONFLICT(scopeKey) DO UPDATE SET lastCursor = excluded.lastCursor, lastSyncedAt = excluded.lastSyncedAt`,
          [scopeKey, newCursor, new Date().toISOString()],
        )
        cursor = newCursor
      })

      await pruneSentOps()
      batches += 1
      if (appliedChanges >= MAX_CHANGES_PER_RUN) break
      if (ops.length === 0) break
      void reason
    }
  } finally {
    isSyncRunning = false
    await refreshLocalCounts()
  }
}

function sanitizePatch(entityType: string, patch: Record<string, unknown>) {
  if (entityType !== "comment") return patch
  if (patch.createdByUserId === "anonymous") {
    return { ...patch, createdByUserId: ANON_USER_ID }
  }
  return patch
}

function mapChangeLogToOp(op: ChangeLogEntry) {
  const parsedPatch = JSON.parse(op.patch) as Record<string, unknown>
  return {
    opId: op.opId,
    entityType: op.entityType,
    entityId: op.entityId,
    opType: op.opType,
    patch: sanitizePatch(op.entityType, parsedPatch),
    baseRevision: op.baseRevision,
    createdAt: op.createdAt,
    projectId: op.projectId ?? null,
  }
}

type SqliteDb = Awaited<ReturnType<typeof getDb>>

async function applyRemoteChange(db: SqliteDb, change: SyncChange) {
  const hasPending = await hasPendingOpsForEntity(db, change.entityType, change.entityId)
  if (hasPending) {
    const localPayload = change.entityType === "task"
      ? await getTaskById(change.entityId)
      : await getCommentById(change.entityId)
    await createConflict(db, change, localPayload)
    return
  }

  const local = change.entityType === "task"
    ? await getTaskById(change.entityId)
    : await getCommentById(change.entityId)
  if (local && isLocalNewer(local.updatedAt, change.updatedAt)) {
    await createConflict(db, change, local)
    return
  }

  if (change.entityType === "task") {
    if (change.opType === "DELETE") {
      await markTaskDeletedFromSync(change.entityId, change.updatedAt, db)
      return
    }
    const payload = change.payload as Task
    const scopeKey = await getActiveScopeKey()
    const resolvedWorkspaceId = payload.workspaceId ?? personalWorkspaceId(scopeKey)
    if (!payload.workspaceId && __DEV__) {
      console.warn("[sync] task missing workspaceId; defaulting to personal", {
        taskId: change.entityId,
        workspaceId: resolvedWorkspaceId,
      })
    }
    const scoped = payload.scopeKey
      ? { ...payload, workspaceId: resolvedWorkspaceId }
      : { ...payload, workspaceId: resolvedWorkspaceId, scopeKey }
    if (__DEV__) {
      console.log("[sync] apply task workspaceId", {
        taskId: payload.id,
        workspaceId: resolvedWorkspaceId,
      })
    }
    await upsertTaskFromSync(scoped, db)
  }

  if (change.entityType === "comment") {
    if (change.opType === "DELETE") {
      await markCommentDeletedFromSync(change.entityId, change.updatedAt, db)
      return
    }
    const payload = change.payload as Comment
    const scoped = payload.scopeKey ? payload : { ...payload, scopeKey: await getActiveScopeKey() }
    await upsertCommentFromSync(scoped, db)
  }

  if (change.entityType === "user") {
    if (change.opType === "DELETE") {
      await markUserDeletedFromSync(change.entityId, change.updatedAt, db)
      return
    }
    const payload = change.payload as any
    const scoped = payload.scopeKey ? payload : { ...payload, scopeKey: await getActiveScopeKey() }
    await upsertUserFromSync(scoped, db)
  }

  if (change.entityType === "workspace_member") {
    if (change.opType === "DELETE") {
      await markWorkspaceMemberDeletedFromSync(change.entityId, change.updatedAt, db)
      return
    }
    const payload = change.payload as any
    const scoped = payload.scopeKey ? payload : { ...payload, scopeKey: await getActiveScopeKey() }
    await upsertWorkspaceMemberFromSync(scoped, db)
  }
}

async function hasPendingOpsForEntity(db: SqliteDb, entityType: string, entityId: string) {
  const scopeKey = await getActiveScopeKey()
  const row = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'PENDING' AND entityType = ? AND entityId = ?",
    [scopeKey, entityType, entityId],
  )
  return (row?.count ?? 0) > 0
}

async function createConflict(db: SqliteDb, change: SyncChange, localPayload?: Task | Comment | null) {
  const localRevision = localPayload?.revision ?? ""
  const conflictId = `${change.entityType}:${change.entityId}`
  const scopeKey = await getActiveScopeKey()

  await execute(
    db,
    `INSERT INTO conflicts (
      id,
      entityType,
      entityId,
      localRevision,
      remoteRevision,
      localPayload,
      remotePayload,
      status,
      createdAt,
      resolvedAt,
      scopeKey
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      localRevision = excluded.localRevision,
      remoteRevision = excluded.remoteRevision,
      localPayload = excluded.localPayload,
      remotePayload = excluded.remotePayload,
      status = 'OPEN',
      createdAt = excluded.createdAt,
      resolvedAt = NULL,
      scopeKey = excluded.scopeKey`,
    [
      conflictId,
      change.entityType,
      change.entityId,
      localRevision,
      change.revision,
      JSON.stringify(localPayload ?? {}),
      JSON.stringify(change.payload),
      "OPEN",
      new Date().toISOString(),
      null,
      scopeKey,
    ],
  )
}

function isLocalNewer(localUpdatedAt: string, remoteUpdatedAt: string) {
  const local = Date.parse(localUpdatedAt)
  const remote = Date.parse(remoteUpdatedAt)
  if (Number.isNaN(local) || Number.isNaN(remote)) return false
  return local > remote
}

function getBackoffMs(attemptCount: number) {
  const base = Math.min(30000, Math.pow(2, attemptCount) * 1000)
  const jitter = Math.floor(Math.random() * 250)
  return base + jitter
}
