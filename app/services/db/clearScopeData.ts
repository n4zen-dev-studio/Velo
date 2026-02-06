import { getDb } from "@/services/db/db"
import { execute, executeTx, executeTransaction } from "@/services/db/queries"
import { ensureBootstrappedForScope } from "@/services/db/bootstrap"

export async function clearScopeData(scopeKey: string) {
  const db = await getDb()
  await executeTransaction(db, async (txDb) => {
    await executeTx(txDb, "DELETE FROM comments WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM task_events WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM tasks WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM statuses WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM project_members WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM projects WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM workspace_members WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM change_log WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM conflicts WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM workspaces WHERE scopeKey = ?", [scopeKey])
    await executeTx(txDb, "DELETE FROM users WHERE scopeKey = ?", [scopeKey])
  })

  await ensureBootstrappedForScope(scopeKey)
}

export async function clearUnsyncedOps(scopeKey: string) {
  const db = await getDb()
  await execute(
    db,
    "DELETE FROM change_log WHERE scopeKey = ? AND status IN ('PENDING','FAILED')",
    [scopeKey],
  )
}
