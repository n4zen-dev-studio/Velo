import { getDb } from "@/services/db/db"
import { queryAll } from "@/services/db/queries"
import type { TaskEvent } from "@/services/db/types"

export async function listTaskEventsByTask(taskId: string) {
  const database = await getDb()
  return queryAll<TaskEvent>(
    database,
    "SELECT * FROM task_events WHERE taskId = ? ORDER BY createdAt DESC",
    [taskId],
  )
}
