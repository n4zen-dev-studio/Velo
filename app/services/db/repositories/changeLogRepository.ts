import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, queryAll, queryFirst } from "@/services/db/queries"
import type { ChangeLogEntry, ChangeLogOpType, ChangeLogStatus } from "@/services/db/types"
import { getCurrentUserId, getDeviceId, generateUuidV4 } from "@/services/sync/identity"
import { getActiveScopeKey } from "@/services/session/scope"

export type EntityType = "task" | "comment" | "project" | "status" | "member" | "user" | "workspace_member"
export type OpType = ChangeLogOpType
export type ChangeStatus = ChangeLogStatus

interface EnqueueParams {
  entityType: EntityType
  entityId: string
  opType: OpType
  patch: Record<string, unknown>
  baseRevision: string
  projectId: string | null
  workspaceId: string
  scopeKey?: string
  createdAt: string
}

export async function enqueueOp(params: EnqueueParams, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const opId = await generateUuidV4()
  const deviceId = await getDeviceId()
  const userId = await getCurrentUserId()
  const scopeKey = params.scopeKey ?? (await getActiveScopeKey())

  await execute(
    database,
    `INSERT INTO change_log (
        opId,
        entityType,
        entityId,
        opType,
      patch,
      baseRevision,
      createdAt,
      deviceId,
      userId,
      projectId,
      workspaceId,
      status,
      attemptCount,
      lastAttemptAt,
      scopeKey
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      opId,
      params.entityType,
      params.entityId,
      params.opType,
      JSON.stringify(params.patch),
      params.baseRevision,
      params.createdAt,
      deviceId,
      userId,
      params.projectId,
      params.workspaceId,
      "PENDING",
      0,
      null,
      scopeKey,
    ],
  )

  return opId
}

export async function listPendingOps(limit = 50, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryAll<ChangeLogEntry>(
    database,
    "SELECT * FROM change_log WHERE scopeKey = ? AND status = 'PENDING' ORDER BY createdAt ASC LIMIT ?",
    [resolvedScope, limit],
  )
}

export async function listFailedOps(limit = 50, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryAll<ChangeLogEntry>(
    database,
    "SELECT * FROM change_log WHERE scopeKey = ? AND status = 'FAILED' ORDER BY lastAttemptAt DESC LIMIT ?",
    [resolvedScope, limit],
  )
}

export async function countPendingOps(scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const row = await queryFirst<{ count: number }>(
    database,
    "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'PENDING'",
    [resolvedScope],
  )
  return row?.count ?? 0
}

export async function countFailedOps(scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const row = await queryFirst<{ count: number }>(
    database,
    "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status = 'FAILED'",
    [resolvedScope],
  )
  return row?.count ?? 0
}

export async function markOpsSent(opIds: string[], db?: SQLiteDatabase) {
  if (opIds.length === 0) return
  const database = db ?? (await getDb())
  const placeholders = opIds.map(() => "?").join(",")
  await execute(
    database,
    `UPDATE change_log SET status = 'SENT' WHERE opId IN (${placeholders})`,
    opIds,
  )
}

export async function markOpFailed(opId: string, errorText?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const now = new Date().toISOString()
  const nextStatus: ChangeLogStatus = "FAILED"
  await execute(
    database,
    `UPDATE change_log
      SET status = ?,
          attemptCount = attemptCount + 1,
          lastAttemptAt = ?
      WHERE opId = ?`,
    [nextStatus, now, opId],
  )
  if (errorText) {
    console.warn(`Change log op ${opId} failed: ${errorText}`)
  }
}

export async function resetFailedToPending() {
  const database = await getDb()
  await execute(database, "UPDATE change_log SET status = 'PENDING' WHERE status = 'FAILED'")
}

export async function pruneSentOps(keepLastN = 2000, olderThanDays = 7) {
  const database = await getDb()
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

  await execute(
    database,
    `DELETE FROM change_log
     WHERE status = 'SENT'
       AND createdAt < ?
       AND opId NOT IN (
         SELECT opId FROM change_log
         WHERE status = 'SENT'
         ORDER BY createdAt DESC
         LIMIT ?
       )`,
    [cutoff, keepLastN],
  )
}

export async function clearSentOps() {
  const database = await getDb()
  await execute(database, "DELETE FROM change_log WHERE status = 'SENT'")
}
