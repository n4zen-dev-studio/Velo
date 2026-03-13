import { getDb } from "@/services/db/db"
import { execute, queryAll, queryFirst } from "@/services/db/queries"
import { enqueueOp } from "@/services/db/repositories/changeLogRepository"
import { upsertCommentFromSync } from "@/services/db/repositories/commentsRepository"
import { upsertTaskFromSync } from "@/services/db/repositories/tasksRepository"
import { personalWorkspaceId } from "@/services/db/repositories/workspacesRepository"
import {
  isWorkspaceScopeKey,
  listAllDataScopeKeys,
  workspaceIdFromScopeKey,
} from "@/services/db/scopeKey"
import type { Comment, ConflictRecord, Task } from "@/services/db/types"
import { getActiveScopeKey } from "@/services/session/scope"
import { refreshLocalCounts } from "@/services/sync/syncStore"

export async function listOpenConflicts() {
  const database = await getDb()
  const scopes = await listAllDataScopeKeys(undefined, database)
  const placeholders = scopes.map(() => "?").join(", ")
  return queryAll<ConflictRecord>(
    database,
    `SELECT * FROM conflicts WHERE scopeKey IN (${placeholders}) AND status = 'OPEN' ORDER BY createdAt DESC`,
    scopes,
  )
}

export async function hasOpenConflict(entityType: string, entityId: string) {
  const database = await getDb()
  const scopes = await listAllDataScopeKeys(undefined, database)
  const placeholders = scopes.map(() => "?").join(", ")
  const id = `${entityType}:${entityId}`
  const row = await queryFirst<{ count: number }>(
    database,
    `SELECT COUNT(1) as count FROM conflicts WHERE scopeKey IN (${placeholders}) AND id = ? AND status = 'OPEN'`,
    [...scopes, id],
  )
  return (row?.count ?? 0) > 0
}

export async function getConflict(entityType: string, entityId: string) {
  const database = await getDb()
  const scopes = await listAllDataScopeKeys(undefined, database)
  const placeholders = scopes.map(() => "?").join(", ")
  const id = `${entityType}:${entityId}`
  return queryFirst<ConflictRecord>(
    database,
    `SELECT * FROM conflicts WHERE scopeKey IN (${placeholders}) AND id = ?`,
    [...scopes, id],
  )
}

export async function resolveConflictKeepLocal(entityType: string, entityId: string) {
  const conflict = await getConflict(entityType, entityId)
  if (!conflict) return
  const localPayload = parsePayload<Task | Comment>(conflict.localPayload)
  await resolveConflict(conflict, localPayload)
}

export async function resolveConflictUseRemote(entityType: string, entityId: string) {
  const conflict = await getConflict(entityType, entityId)
  if (!conflict) return
  const remotePayload = parsePayload<Task | Comment>(conflict.remotePayload)
  await resolveConflict(conflict, remotePayload)
}

export async function resolveConflictMerge(
  entityType: string,
  entityId: string,
  mergedPayload: Task | Comment,
) {
  const conflict = await getConflict(entityType, entityId)
  if (!conflict) return
  await resolveConflict(conflict, mergedPayload)
}

async function resolveConflict(conflict: ConflictRecord, payload: Task | Comment) {
  const database = await getDb()
  const now = new Date().toISOString()
  const nextRevision = `rev-${Date.now()}`
  const scopeKey = conflict.scopeKey ?? (await getActiveScopeKey())

  if (conflict.entityType === "task") {
    const task = payload as Task
    const fallbackWorkspaceId = isWorkspaceScopeKey(scopeKey)
      ? workspaceIdFromScopeKey(scopeKey)
      : personalWorkspaceId(scopeKey)
    const updatedTask: Task = {
      id: task.id,
      projectId: task.projectId ?? null,
      workspaceId: task.workspaceId ?? fallbackWorkspaceId ?? personalWorkspaceId(scopeKey),
      title: task.title ?? "",
      description: task.description ?? "",
      statusId: task.statusId ?? "todo",
      priority: task.priority ?? "medium",
      assigneeUserId: task.assigneeUserId ?? null,
      createdByUserId: task.createdByUserId ?? "",
      startDate: task.startDate ?? null,
      endDate: task.endDate ?? null,
      updatedAt: now,
      revision: nextRevision,
      deletedAt: task.deletedAt ?? null,
      scopeKey,
    }

    await upsertTaskFromSync(updatedTask)
    await enqueueOp({
      entityType: "task",
      entityId: updatedTask.id,
      opType: updatedTask.deletedAt ? "DELETE" : "UPSERT",
      patch: updatedTask as unknown as Record<string, unknown>,
      baseRevision: conflict.remoteRevision,
      projectId: updatedTask.projectId ?? null,
      workspaceId: updatedTask.workspaceId,
      scopeKey,
      createdAt: now,
    })
  }

  if (conflict.entityType === "comment") {
    const comment = payload as Comment
    const updatedComment: Comment = {
      id: comment.id,
      taskId: comment.taskId,
      body: comment.body ?? "",
      createdByUserId: comment.createdByUserId ?? "",
      createdAt: comment.createdAt ?? now,
      updatedAt: now,
      revision: nextRevision,
      deletedAt: comment.deletedAt ?? null,
      scopeKey,
    }

    await upsertCommentFromSync(updatedComment)
    const taskRow = await queryFirst<{ workspaceId: string }>(
      database,
      "SELECT workspaceId FROM tasks WHERE id = ? AND scopeKey = ?",
      [updatedComment.taskId, scopeKey],
    )
    const workspaceId =
      taskRow?.workspaceId ?? workspaceIdFromScopeKey(scopeKey) ?? personalWorkspaceId(scopeKey)
    await enqueueOp({
      entityType: "comment",
      entityId: updatedComment.id,
      opType: updatedComment.deletedAt ? "DELETE" : "UPSERT",
      patch: updatedComment as unknown as Record<string, unknown>,
      baseRevision: conflict.remoteRevision,
      projectId: null,
      workspaceId,
      scopeKey,
      createdAt: now,
    })
  }

  await execute(
    database,
    "UPDATE conflicts SET status = 'RESOLVED', resolvedAt = ? WHERE id = ? AND scopeKey = ?",
    [now, conflict.id, scopeKey],
  )

  await refreshLocalCounts()
}

function parsePayload<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return {} as T
  }
}
