import { getAccessToken } from "@/services/api/tokenStore"
import { getStoredUserId } from "@/services/sync/identity"

export const GUEST_SCOPE_KEY = "guest"

export const userScopeKey = (userId: string) => `user:${userId}`

export function isUserScope(scopeKey: string) {
  return scopeKey.startsWith("user:")
}

export function scopeUserId(scopeKey: string) {
  return isUserScope(scopeKey) ? scopeKey.slice(5) : null
}

export async function getActiveScopeKey() {
  const [token, userId] = await Promise.all([getAccessToken(), getStoredUserId()])
  if (token && userId) return userScopeKey(userId)
  return GUEST_SCOPE_KEY
}
