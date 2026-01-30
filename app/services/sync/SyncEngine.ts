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
import type { Comment, Task } from "@/services/db/types"
import { createHttpClient } from "@/services/api/httpClient"
import { sync as syncApi } from "@/services/api/syncApi"
import type { SyncChange, SyncRequest } from "@/services/sync/syncContract"
import { getDeviceId } from "@/services/sync/identity"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { BASE_URL } from "@/config/api"
import { delay } from "@/utils/delay"

const SYNC_STATE_ID = "singleton"
const MAX_OPS_PER_BATCH = 50
const MAX_BATCHES = 5
const MAX_CHANGES_PER_RUN = 500
let isSyncRunning = false
let consecutiveFailures = 0

export async function runSync(reason?: string) {
  if (isSyncRunning) return
  isSyncRunning = true
  const db = await getDb()

  try {
    const cursorRow = await queryFirst<{ lastCursor: string | null }>(
      db,
      "SELECT lastCursor FROM sync_state WHERE id = ?",
      [SYNC_STATE_ID],
    )

    const deviceId = await getDeviceId()
    const client = createHttpClient(BASE_URL)
    let batches = 0
    let cursor = cursorRow?.lastCursor ?? null

    let appliedChanges = 0
    while (batches < MAX_BATCHES) {
      const ops = await listPendingOps(MAX_OPS_PER_BATCH)
      if (ops.length === 0) break

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
          `INSERT INTO sync_state (id, lastCursor, lastSyncedAt)
           VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET lastCursor = excluded.lastCursor, lastSyncedAt = excluded.lastSyncedAt`,
          [SYNC_STATE_ID, newCursor, new Date().toISOString()],
        )
        cursor = newCursor
      })

      await pruneSentOps()
      batches += 1
      if (appliedChanges >= MAX_CHANGES_PER_RUN) break
      void reason
    }
  } finally {
    isSyncRunning = false
    await refreshLocalCounts()
  }
}

function mapChangeLogToOp(op: { opId: string; entityType: string; entityId: string; opType: string; patch: string; baseRevision: string; createdAt: string; projectId: string | null }) {
  return {
    opId: op.opId,
    entityType: op.entityType,
    entityId: op.entityId,
    opType: op.opType,
    patch: JSON.parse(op.patch),
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
    await upsertTaskFromSync(payload, db)
  }

  if (change.entityType === "comment") {
    if (change.opType === "DELETE") {
      await markCommentDeletedFromSync(change.entityId, change.updatedAt, db)
      return
    }
    const payload = change.payload as Comment
    await upsertCommentFromSync(payload, db)
  }
}

async function hasPendingOpsForEntity(db: SqliteDb, entityType: string, entityId: string) {
  const row = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM change_log WHERE status = 'PENDING' AND entityType = ? AND entityId = ?",
    [entityType, entityId],
  )
  return (row?.count ?? 0) > 0
}

async function createConflict(db: SqliteDb, change: SyncChange, localPayload?: Task | Comment | null) {
  const localRevision = localPayload?.revision ?? ""
  const conflictId = `${change.entityType}:${change.entityId}`

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
      resolvedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      localRevision = excluded.localRevision,
      remoteRevision = excluded.remoteRevision,
      localPayload = excluded.localPayload,
      remotePayload = excluded.remotePayload,
      status = 'OPEN',
      createdAt = excluded.createdAt,
      resolvedAt = NULL`,
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
