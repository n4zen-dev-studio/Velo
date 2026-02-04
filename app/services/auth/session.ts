import { useSyncExternalStore } from "react"

import { getAccessToken } from "@/services/api/tokenStore"
import { getStoredUserId } from "@/services/sync/identity"

type AuthSessionState = {
  token: string | null
  currentUserId: string | null
  isAuthenticated: boolean
}

let state: AuthSessionState = {
  token: null,
  currentUserId: null,
  isAuthenticated: false,
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setState(next: AuthSessionState) {
  if (
    next.token === state.token &&
    next.currentUserId === state.currentUserId &&
    next.isAuthenticated === state.isAuthenticated
  ) {
    return
  }
  state = next
  emit()
}

export async function refreshAuthSession() {
  const [token, currentUserId] = await Promise.all([getAccessToken(), getStoredUserId()])
  setState({
    token,
    currentUserId,
    isAuthenticated: !!token && !!currentUserId,
  })
}

export function setAuthSession(token: string | null, currentUserId: string | null) {
  setState({
    token,
    currentUserId,
    isAuthenticated: !!token && !!currentUserId,
  })
}

export function clearAuthSession() {
  setState({
    token: null,
    currentUserId: null,
    isAuthenticated: false,
  })
}

export function getAuthSession() {
  return state
}

export function subscribeAuthSession(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAuthSession() {
  return useSyncExternalStore(subscribeAuthSession, getAuthSession, getAuthSession)
}

export function useIsAuthenticated() {
  return useAuthSession().isAuthenticated
}

export async function getAuthToken() {
  return getAccessToken()
}
