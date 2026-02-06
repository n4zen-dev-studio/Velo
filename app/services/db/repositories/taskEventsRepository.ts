import { getDb } from "@/services/db/db"
import { queryAll } from "@/services/db/queries"
import type { TaskEvent } from "@/services/db/types"
import { resolveScopeKeyForTaskId } from "@/services/db/scopeKey"

export async function listTaskEventsByTask(taskId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = await resolveScopeKeyForTaskId(taskId, scopeKey, database)
  return queryAll<TaskEvent>(
    database,
    "SELECT * FROM task_events WHERE scopeKey = ? AND taskId = ? ORDER BY createdAt DESC",
    [resolvedScope, taskId],
  )
}
