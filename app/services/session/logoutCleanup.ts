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
    if (params.mode === "user_wipe_logout") {
      if (!params.userId) return
      await executeTx(
        txDb,
        "DELETE FROM change_log WHERE userId = ? AND status = 'PENDING'",
        [params.userId],
      )
    }

    if (params.mode === "guest_wipe") {
      await executeTx(txDb, "DELETE FROM tasks WHERE scopeKey = 'guest'")
      await executeTx(txDb, "DELETE FROM comments WHERE scopeKey = 'guest'")
      await executeTx(txDb, "DELETE FROM change_log WHERE scopeKey = 'guest'")
    }
  })
}
