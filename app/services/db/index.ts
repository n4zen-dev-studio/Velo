export * from "./db"
export * from "./migrations"
export * from "./schema"
export * from "./types"
export * from "./repositories/commentsRepository"
export * from "./repositories/changeLogRepository"
export * from "./repositories/conflictsRepository"
export * from "./repositories/projectsRepository"
export * from "./repositories/taskEventsRepository"
export * from "./repositories/taskAttachmentsRepository"
export * from "./repositories/statusesRepository"
export * from "./repositories/tasksRepository"
export * from "./repositories/workspacesRepository"
export * as usersRepository from "./repositories/usersRepository"
export * as workspaceMembersRepository from "./repositories/workspaceMembersRepository"

import { getDb } from "./db"
import { executeTx, executeTransaction } from "./queries"
import { ensureBootstrappedForScope } from "./bootstrap"
import { getActiveScopeKey } from "@/services/session/scope"

// Workspace bootstrapping happens here via bootstrapWorkspaces (Personal + active id + default statuses).
// When adding new user-owned entities, include a `workspaceId` column and default to the active workspace in repos + migrations.
export async function initializeDatabase() {
  const scopeKey = await getActiveScopeKey()
  await ensureBootstrappedForScope(scopeKey)
}

// export async function clearLocalData() {
//   const db = await getDb()
//   await executeTransaction(db, async (txDb) => {
//     await execute(txDb, "DELETE FROM comments")
//     await execute(txDb, "DELETE FROM tasks")
//     await execute(txDb, "DELETE FROM task_events")
//     await execute(txDb, "DELETE FROM change_log")
//     await execute(txDb, "DELETE FROM conflicts")
//     await execute(txDb, "DELETE FROM sync_state")
//     await execute(txDb, "DELETE FROM workspace_state")
//     await execute(txDb, "DELETE FROM workspaces")
//   })
// }

export async function clearLocalData() {
  const db = await getDb()

  await executeTransaction(db, async (txDb) => {
    // If you have foreign keys enabled, order matters: delete children first.

    // Collaboration / membership
    await executeTx(txDb, "DELETE FROM workspace_members")
    // If you cache invites locally at any point:
    // await execute(txDb, "DELETE FROM workspace_invites")

    // Task-related
    await executeTx(txDb, "DELETE FROM comments")
    await executeTx(txDb, "DELETE FROM task_events")
    await executeTx(txDb, "DELETE FROM task_attachments")
    await executeTx(txDb, "DELETE FROM tasks")

    // Statuses / projects (if statuses reference workspace/project)
    await executeTx(txDb, "DELETE FROM statuses")
    await executeTx(txDb, "DELETE FROM projects")

    // Sync + conflicts
    await executeTx(txDb, "DELETE FROM conflicts")
    await executeTx(txDb, "DELETE FROM change_log")
    await executeTx(txDb, "DELETE FROM sync_state")
    await executeTx(txDb, "DELETE FROM workspace_state")

    // Users (so UUID -> username/email doesn’t leak between sessions)
    await executeTx(txDb, "DELETE FROM users")

    // Finally workspaces
    await executeTx(txDb, "DELETE FROM workspaces")
  })

  // Recreate required baseline state (personal workspace, default statuses, active workspace id)
  await initializeDatabase()
}
