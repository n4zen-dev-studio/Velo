import { setTokens } from "@/services/api/tokenStore"
import { refreshAuthSession } from "@/services/auth/session"
import { ensureBootstrappedForScope } from "@/services/db/bootstrap"
import {
  personalWorkspaceId,
  setActiveWorkspaceId,
} from "@/services/db/repositories/workspacesRepository"
import { userScopeKey } from "@/services/session/scope"
import { logScopeAction, withScopeTransitionLock } from "@/services/session/scopeTransition"
import { clearOfflineMode } from "@/services/storage/session"
import { setCurrentUserId, setSessionMode } from "@/services/sync/identity"
import {
  claimOfflineData,
  discardGuestData,
  markOfflineClaimHandled,
  shouldPromptOfflineClaim,
} from "@/services/sync/offlineClaim"
import { syncController } from "@/services/sync/SyncController"

function parseUserIdFromJwt(token: string) {
  try {
    const payload = token.split(".")[1]
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const decoded =
      typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary")
    const data = JSON.parse(decoded)
    return data.sub as string | undefined
  } catch {
    return undefined
  }
}

export async function prepareRemoteLogin(accessToken: string, refreshToken: string) {
  await setTokens(accessToken, refreshToken)
  const userId = parseUserIdFromJwt(accessToken)
  if (!userId) {
    throw new Error("Unable to read user session.")
  }
  const needsClaim = await shouldPromptOfflineClaim()
  return { userId, needsClaim }
}

export async function finalizeRemoteLogin(userId: string, transitionLabel = "login_remote") {
  await withScopeTransitionLock(async () => {
    syncController.pause()
    const scopeKey = userScopeKey(userId)
    logScopeAction(transitionLabel, scopeKey, userId)
    await setCurrentUserId(userId)
    await setSessionMode("remote")
    await clearOfflineMode()
    await refreshAuthSession()
    await ensureBootstrappedForScope(scopeKey)
    await setActiveWorkspaceId(personalWorkspaceId(scopeKey), scopeKey)
    syncController.resume()
  }, transitionLabel)
}

export async function claimPendingOfflineData(
  pendingRemoteUserId: string,
  transitionLabel = "claim_offline_data",
) {
  await withScopeTransitionLock(async () => {
    syncController.pause()
    const scopeKey = userScopeKey(pendingRemoteUserId)
    logScopeAction(transitionLabel, scopeKey, pendingRemoteUserId)
    await setCurrentUserId(pendingRemoteUserId)
    await setSessionMode("remote")
    await claimOfflineData(pendingRemoteUserId)
    markOfflineClaimHandled()
    await clearOfflineMode()
    await refreshAuthSession()
    await ensureBootstrappedForScope(scopeKey)
    await setActiveWorkspaceId(personalWorkspaceId(scopeKey), scopeKey)
    syncController.resume()
  }, transitionLabel)
}

export async function keepRemoteDataSeparate(
  pendingRemoteUserId: string,
  transitionLabel = "discard_offline_data",
) {
  await withScopeTransitionLock(async () => {
    syncController.pause()
    const scopeKey = userScopeKey(pendingRemoteUserId)
    logScopeAction(transitionLabel, scopeKey, pendingRemoteUserId)
    await setCurrentUserId(pendingRemoteUserId)
    await setSessionMode("remote")
    await discardGuestData()
    markOfflineClaimHandled()
    await clearOfflineMode()
    await refreshAuthSession()
    await ensureBootstrappedForScope(scopeKey)
    await setActiveWorkspaceId(personalWorkspaceId(scopeKey), scopeKey)
    syncController.resume()
  }, transitionLabel)
}
