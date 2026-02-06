import { useSyncExternalStore } from "react"

import { getDb } from "@/services/db/db"
import { queryFirst } from "@/services/db/queries"
import { countPendingOpsForScopes } from "@/services/db/repositories/changeLogRepository"
import { getActiveScopeKey } from "@/services/session/scope"
import type { SyncBadgeState, SyncPhase } from "@/services/sync/syncTypes"
import { listAllDataScopeKeys } from "@/services/db/scopeKey"

interface SyncStoreState {
  phase: SyncPhase
  lastError: string | null
  lastSyncedAt: string | null
  pendingCount: number
  conflictCount: number
  isOnline: boolean
}

let state: SyncStoreState = {
  phase: "idle",
  lastError: null,
  lastSyncedAt: null,
  pendingCount: 0,
  conflictCount: 0,
  isOnline: true,
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function getSyncState() {
  return state
}

export function subscribeSyncStore(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setState(partial: Partial<SyncStoreState>) {
  const next = { ...state, ...partial }
  if (
    next.phase === state.phase &&
    next.lastError === state.lastError &&
    next.lastSyncedAt === state.lastSyncedAt &&
    next.pendingCount === state.pendingCount &&
    next.conflictCount === state.conflictCount &&
    next.isOnline === state.isOnline
  ) {
    return
  }
  state = next
  emit()
}

export async function refreshLocalCounts() {
  const scopeKey = await getActiveScopeKey()
  const scopes = await listAllDataScopeKeys(scopeKey)
  const [pendingCount, conflictCount] = await Promise.all([
    countPendingOpsForScopes(scopes),
    countConflicts(scopes),
  ])
  setState({ pendingCount, conflictCount })
}

export function setOnlineStatus(isOnline: boolean) {
  setState({ isOnline })
}

export function setPhase(phase: SyncPhase) {
  setState({ phase })
}

export function setLastError(error: string | null) {
  setState({ lastError: error, phase: error ? "error" : state.phase })
}

export function setLastSyncedAt(timestamp: string | null) {
  setState({ lastSyncedAt: timestamp })
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStore, getSyncState, getSyncState)
}

export function deriveSyncBadgeState(snapshot: SyncStoreState): SyncBadgeState {
  if (!snapshot.isOnline) return "offline"
  if (snapshot.conflictCount > 0) return "conflicts"
  if (snapshot.phase === "syncing") return "syncing"
  if (snapshot.lastError) return "error"
  if (snapshot.pendingCount > 0) return "pending"
  return "idle"
}

async function countConflicts(scopes: string[]) {
  const db = await getDb()
  if (scopes.length === 0) return 0
  const placeholders = scopes.map(() => "?").join(", ")
  const row = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(1) as count FROM conflicts WHERE scopeKey IN (${placeholders}) AND status = 'OPEN'`,
    scopes,
  )
  return row?.count ?? 0
}
