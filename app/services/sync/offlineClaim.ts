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
    // Reset remote scope cache so we re-sync cleanly
    await executeTx(txDb, "DELETE FROM workspace_state WHERE scopeKey = ?", [userScope])
    await executeTx(txDb, "DELETE FROM sync_state WHERE scopeKey = ?", [userScope])

    // Identify personal workspaces BEFORE moving scope keys
    const remotePersonalRes = await executeTx(
      txDb,
      "SELECT id FROM workspaces WHERE scopeKey = ? AND kind = ? LIMIT 1",
      [userScope, "personal"],
    )
    const guestPersonalRes = await executeTx(
      txDb,
      "SELECT id FROM workspaces WHERE scopeKey = ? AND kind = ? LIMIT 1",
      [GUEST_SCOPE_KEY, "personal"],
    )

    // const remotePersonalId = remotePersonalRes?.rows?.[0]?.id
    const guestPersonalId = guestPersonalRes?.rows?.[0]?.id

    let remotePersonalId = remotePersonalRes?.rows?.[0]?.id

if (!remotePersonalId) {
  // Fallback 1: if there is ANY workspace for this scope, promote it to personal
  const anyWs = await executeTx(
    txDb,
    "SELECT id FROM workspaces WHERE scopeKey = ? LIMIT 1",
    [userScope],
  )
  const anyId = anyWs?.rows?.[0]?.id

  if (anyId) {
    await executeTx(
      txDb,
      "UPDATE workspaces SET kind = ? WHERE scopeKey = ? AND id = ?",
      ["personal", userScope, anyId],
    )
    remotePersonalId = anyId
  }
}

    // Move guest rows into user scope
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
    await executeTx(txDb, "UPDATE users SET scopeKey = ? WHERE scopeKey = ?", [userScope, GUEST_SCOPE_KEY])

    // Merge guest personal -> remote personal (workspace id remap)
    if (guestPersonalId && guestPersonalId !== remotePersonalId) {
      // Tasks should end up in the remote personal workspace
      await executeTx(
        txDb,
        "UPDATE tasks SET workspaceId = ? WHERE scopeKey = ? AND workspaceId = ?",
        [remotePersonalId, userScope, guestPersonalId],
      )

      // If these tables have workspaceId, remap them too.
      // (If any of these tables don't have workspaceId in your schema, remove those lines.)
      await executeTx(
        txDb,
        "UPDATE projects SET workspaceId = ? WHERE scopeKey = ? AND workspaceId = ?",
        [remotePersonalId, userScope, guestPersonalId],
      ).catch(() => {})

      await executeTx(
        txDb,
        "UPDATE statuses SET workspaceId = ? WHERE scopeKey = ? AND workspaceId = ?",
        [remotePersonalId, userScope, guestPersonalId],
      ).catch(() => {})

      await executeTx(
        txDb,
        "UPDATE workspace_members SET workspaceId = ? WHERE scopeKey = ? AND workspaceId = ?",
        [remotePersonalId, userScope, guestPersonalId],
      ).catch(() => {})

      // Delete the duplicate personal workspace row (the one migrated from guest)
      await executeTx(txDb, "DELETE FROM workspaces WHERE scopeKey = ? AND id = ?", [userScope, guestPersonalId])
    }

    // Rewrite task ownership from guest/anonymous -> logged-in user
    // This covers nulls + the "anonymous" string you mentioned.
    await executeTx(
      txDb,
      "UPDATE tasks SET createdByUserId = ? WHERE scopeKey = ? AND (createdByUserId IS NULL OR createdByUserId = ?)",
      [remoteUserId, userScope, "anonymous"],
    )
    await executeTx(
      txDb,
      "UPDATE tasks SET assigneeUserId = ? WHERE scopeKey = ? AND (assigneeUserId IS NULL OR assigneeUserId = ?)",
      [remoteUserId, userScope, "anonymous"],
    )
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
