export * from "./db"
export * from "./migrations"
export * from "./schema"
export * from "./types"
export * from "./repositories/commentsRepository"
export * from "./repositories/changeLogRepository"
export * from "./repositories/conflictsRepository"
export * from "./repositories/projectsRepository"
export * from "./repositories/taskEventsRepository"
export * from "./repositories/statusesRepository"
export * from "./repositories/tasksRepository"

import { getDb } from "./db"
import { migrate } from "./migrations"
import { seedDefaultStatuses } from "./repositories/statusesRepository"
import { executeTransaction } from "./queries"
import { execute } from "./queries"

export async function initializeDatabase() {
  const db = await getDb()
  await seedDefaultStatuses(db)
}

export async function clearLocalData() {
  const db = await getDb()
  await executeTransaction(db, async (txDb) => {
    await execute(txDb, "DELETE FROM comments")
    await execute(txDb, "DELETE FROM tasks")
    await execute(txDb, "DELETE FROM task_events")
    await execute(txDb, "DELETE FROM change_log")
    await execute(txDb, "DELETE FROM conflicts")
    await execute(txDb, "DELETE FROM sync_state")
  })
}
