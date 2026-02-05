import { getDb } from "@/services/db/db"
import { execute, executeTransaction } from "@/services/db/queries"
import { bootstrapWorkspaces } from "@/services/db/repositories/workspacesRepository"

export async function clearScopeData(scopeKey: string) {
  const db = await getDb()
  await executeTransaction(db, async (txDb) => {
    await execute(txDb, "DELETE FROM comments WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM task_events WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM tasks WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM statuses WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM project_members WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM projects WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM workspace_members WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM change_log WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM conflicts WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM workspaces WHERE scopeKey = ?", [scopeKey])
    await execute(txDb, "DELETE FROM users WHERE scopeKey = ?", [scopeKey])
  })

  await bootstrapWorkspaces(scopeKey)
}

export async function clearUnsyncedOps(scopeKey: string) {
  const db = await getDb()
  await execute(
    db,
    "DELETE FROM change_log WHERE scopeKey = ? AND status IN ('PENDING','FAILED')",
    [scopeKey],
  )
}
