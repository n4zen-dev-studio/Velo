import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryFirst } from "@/services/db/queries"
import { bootstrapWorkspaces } from "@/services/db/repositories/workspacesRepository"
import { GUEST_SCOPE_KEY, userScopeKey } from "@/services/session/scope"
import { loadString, saveString } from "@/utils/storage"

const OFFLINE_CLAIM_KEY = "tasktrak.offlineClaimed"

export async function shouldPromptOfflineClaim() {
  const claimed = loadString(OFFLINE_CLAIM_KEY)
  if (claimed === "true") return false
  return hasGuestData()
}

export function markOfflineClaimHandled() {
  saveString(OFFLINE_CLAIM_KEY, "true")
}

export async function claimOfflineData(remoteUserId: string) {
  const userScope = userScopeKey(remoteUserId)
  const db = await getDb()

  await executeTransaction(db, async (txDb) => {
    await execute(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [userScope])
    await execute(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [userScope])

    await execute(txDb, "UPDATE workspaces SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE statuses SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE projects SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE project_members SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE tasks SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE comments SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE task_events SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE workspace_members SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE conflicts SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE change_log SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE sync_state SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE workspace_state SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
    await execute(txDb, "UPDATE users SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])
  })

  await bootstrapWorkspaces(userScope)
}

export async function discardGuestData() {
  const db = await getDb()
  await executeTransaction(db, async (txDb) => {
    await execute(txDb, "DELETE FROM comments WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM task_events WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM tasks WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM statuses WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM project_members WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM projects WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM workspace_members WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM change_log WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM conflicts WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM workspaces WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
    await execute(txDb, "DELETE FROM users WHERE scopeKey = ?", [GUEST_SCOPE_KEY])
  })

  await bootstrapWorkspaces(GUEST_SCOPE_KEY)
}

async function hasGuestData() {
  const db = await getDb()
  const [taskRow, commentRow, opRow] = await Promise.all([
    queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(1) as count FROM tasks WHERE scopeKey = ? AND deletedAt IS NULL",
      [GUEST_SCOPE_KEY],
    ),
    queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(1) as count FROM comments WHERE scopeKey = ? AND deletedAt IS NULL",
      [GUEST_SCOPE_KEY],
    ),
    queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(1) as count FROM change_log WHERE scopeKey = ? AND status IN ('PENDING','FAILED')",
      [GUEST_SCOPE_KEY],
    ),
  ])

  return (taskRow?.count ?? 0) > 0 || (commentRow?.count ?? 0) > 0 || (opRow?.count ?? 0) > 0
}
