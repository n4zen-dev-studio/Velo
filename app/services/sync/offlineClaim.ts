import { getDb } from "@/services/db/db"
import { executeTx, executeTransaction, queryFirst } from "@/services/db/queries"
import { ensureBootstrappedForScope } from "@/services/db/bootstrap"
import { GUEST_SCOPE_KEY, userScopeKey } from "@/services/session/scope"
import { loadString, remove, saveString } from "@/utils/storage"

const OFFLINE_CLAIM_KEY = "tasktrak.offlineClaimed"

export async function shouldPromptOfflineClaim() {
  const hasData = await hasGuestData()
  if (hasData) return true
  const claimed = loadString(OFFLINE_CLAIM_KEY)
  if (claimed === "true") return false
  return false
}

export function markOfflineClaimHandled() {
  saveString(OFFLINE_CLAIM_KEY, "true")
}

export function resetOfflineClaimHandled() {
  remove(OFFLINE_CLAIM_KEY)
}

export async function claimOfflineData(remoteUserId: string) {
  const userScope = userScopeKey(remoteUserId)
  const db = await getDb()

  await executeTransaction(db, async (txDb) => {
    await executeTx(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [userScope])
    await executeTx(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [userScope])

    await executeTx(txDb, "UPDATE workspaces SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE statuses SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE projects SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE project_members SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE tasks SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE comments SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE task_events SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE workspace_members SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE conflicts SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE change_log SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE sync_state SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE workspace_state SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await executeTx(txDb, "UPDATE users SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
  })

  await ensureBootstrappedForScope(userScope)
}

export async function discardGuestData() {
  const db = await getDb()
  await executeTransaction(db, async (txDb) => {
    await executeTx(txDb, "DELETE FROM comments WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM task_events WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM tasks WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM statuses WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM project_members WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM projects WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM workspace_members WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM change_log WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM conflicts WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM workspaces WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await executeTx(txDb, "DELETE FROM users WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
  })

  await ensureBootstrappedForScope(GUEST_SCOPE_KEY)
}

async function hasGuestData() {
  const db = await getDb()
  const opRow = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ?",
    [GUEST_SCOPE_KEY],
  )

  return (opRow?.count ?? 0) > 0
}
