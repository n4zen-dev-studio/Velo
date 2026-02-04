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
export * from "./repositories/workspacesRepository"

import { getDb } from "./db"
import { execute, executeTransaction } from "./queries"
import { bootstrapWorkspaces } from "./repositories/workspacesRepository"

// Workspace bootstrapping happens here via bootstrapWorkspaces (Personal + active id + default statuses).
// When adding new user-owned entities, include a `workspaceId` column and default to the active workspace in repos + migrations.
export async function initializeDatabase() {
  const db = await getDb()
  await bootstrapWorkspaces(db)
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
    await execute(txDb, "DELETE FROM workspace_state")
    await execute(txDb, "DELETE FROM workspaces")
  })
}
