import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryFirst } from "@/services/db/queries"
import { listPendingOps, markOpsSent } from "@/services/db/repositories/changeLogRepository"
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

const SYNC_STATE_ID = "singleton"

export async function runSync() {
  const db = await getDb()

  const cursorRow = await queryFirst<{ lastCursor: string | null }>(
    db,
    "SELECT lastCursor FROM sync_state WHERE id = ?",
    [SYNC_STATE_ID],
  )

  const ops = await listPendingOps(100)
  const deviceId = await getDeviceId()

  const payload: SyncRequest = {
    cursor: cursorRow?.lastCursor ?? null,
    deviceId,
    ops: ops.map(mapChangeLogToOp),
  }

  const client = createHttpClient(BASE_URL)
  const response = await syncApi(client, payload)

  await executeTransaction(db, async (txDb) => {
    await markOpsSent(response.ackOpIds, txDb)

    for (const change of response.changes) {
      await applyRemoteChange(txDb, change)
    }

    const newCursor = response.newCursor ?? payload.cursor
    await execute(
      txDb,
      `INSERT INTO sync_state (id, lastCursor, lastSyncedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET lastCursor = excluded.lastCursor, lastSyncedAt = excluded.lastSyncedAt`,
      [SYNC_STATE_ID, newCursor, new Date().toISOString()],
    )
  })

  await refreshLocalCounts()
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
  const conflictId = `conflict-${change.entityType}-${change.entityId}-${Date.now()}`

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
    ON CONFLICT(id) DO NOTHING`,
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
