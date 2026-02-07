import { getDb } from "@/services/db/db"
import { queryAll } from "@/services/db/queries"
import type { TaskEvent } from "@/services/db/types"
import { executeTx } from "@/services/db/queries"
import type { SQLiteDatabase } from "expo-sqlite" 

import { getTaskById } from "@/services/db/repositories/tasksRepository"
import { personalWorkspaceId } from "@/services/db/repositories/workspacesRepository"
import { resolveWorkspaceScopeKey, resolveScopeKeyForTaskId } from "@/services/db/scopeKey"
import { getActiveScopeKey } from "@/services/session/scope"

export async function listTaskEventsByTask(taskId: string, scopeKey?: string) {
  const database = await getDb()
  const baseScope = scopeKey ?? (await getActiveScopeKey())

  const task = await getTaskById(taskId, database)

  // Prefer workspace scope (task_events are synced in workspace scope)
  let resolvedScope: string
  if (task?.workspaceId) {
    resolvedScope = await resolveWorkspaceScopeKey(task.workspaceId, baseScope, database)
  } else {
    // Fallback if task not found yet or workspaceId missing
    resolvedScope = await resolveScopeKeyForTaskId(taskId, baseScope, database)
  }

  return queryAll<TaskEvent>(
    database,
    "SELECT * FROM task_events WHERE scopeKey = ? AND taskId = ? ORDER BY createdAt DESC",
    [resolvedScope, taskId],
  )
}

export async function upsertTaskEventFromSync(payload: any, db: SQLiteDatabase) {
  await executeTx(
    db,
    `
    INSERT INTO task_events (id, taskId, type, payload, createdAt, createdByUserId, scopeKey)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      taskId = excluded.taskId,
      type = excluded.type,
      payload = excluded.payload,
      createdAt = excluded.createdAt,
      createdByUserId = excluded.createdByUserId,
      scopeKey = excluded.scopeKey
    `,
    [
      payload.id,
      payload.taskId,
      payload.type,
      payload.payload,
      payload.createdAt,
      payload.createdByUserId,
      payload.scopeKey,
    ],
  )
}

export async function markTaskEventDeletedFromSync(id: string, _updatedAt: string, db: SQLiteDatabase) {
  // If you add deletedAt to the table later, switch to soft delete.
  await executeTx(db, "DELETE FROM task_events WHERE id = ?", [id])
}
