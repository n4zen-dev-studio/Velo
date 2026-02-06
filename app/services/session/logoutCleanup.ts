import { getDb } from "@/services/db/db"
import { executeTransaction, executeTx } from "@/services/db/queries"

export type LogoutCleanupMode =
  | "guest_keep"
  | "guest_wipe"
  | "user_sync_logout"
  | "user_wipe_logout"

export async function logoutCleanup(params: { mode: LogoutCleanupMode; userId?: string }) {
  const db = await getDb()

  await executeTransaction(db, async (txDb) => {
    // 1) Logged-in user wants to WIPE unsynced changes (do NOT sync)
    if (params.mode === "user_wipe_logout") {
      const userId = params.userId
      if (!userId) return

      // Remove any unsynced ops (PENDING + FAILED)
      await executeTx(
        txDb,
        "DELETE FROM change_log WHERE userId = ? AND status IN ('PENDING', 'FAILED')",
        [userId],
      )

      // If you store conflicts and want wipe to discard local conflict state too:
      // await executeTx(txDb, "DELETE FROM conflicts WHERE scopeKey = ?", [`user:${userId}`])

      // If you store per-user sync cursor/state:
      // await executeTx(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [`user:${userId}`])
    }

    // 2) Guest wipe: delete ALL guest-scoped data in safe order
    if (params.mode === "guest_wipe") {
      const scopeKey = "guest"

      // Task children first
      await executeTx(txDb, "DELETE FROM comments WHERE scopeKey = ?", [scopeKey])
      await executeTx(txDb, "DELETE FROM task_events WHERE scopeKey = ?", [scopeKey])

      // Tasks
      await executeTx(txDb, "DELETE FROM tasks WHERE scopeKey = ?", [scopeKey])

      // Statuses/projects if guest-scoped in your schema
      // await executeTx(txDb, "DELETE FROM statuses WHERE scopeKey = ?", [scopeKey])
      // await executeTx(txDb, "DELETE FROM projects WHERE scopeKey = ?", [scopeKey])

      // Changelog last (no FK dependency, but logically last)
      await executeTx(txDb, "DELETE FROM change_log WHERE scopeKey = ?", [scopeKey])

      // Workspace/session state for guest scope (if scoped)
      await executeTx(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [scopeKey])
      await executeTx(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [scopeKey])

      // Workspaces & membership for guest scope if you scope them
      // await executeTx(txDb, "DELETE FROM workspace_members WHERE scopeKey = ?", [scopeKey])
      // await executeTx(txDb, "DELETE FROM workspaces WHERE scopeKey = ?", [scopeKey])
    }
  })
}
