import { useSyncExternalStore } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

export type SyncMode = "manual" | "automatic"
export type SyncNetworkPolicy = "wifi_only" | "any"
export type SyncConnectionType = "wifi" | "cellular" | "ethernet" | "none" | "other" | "unknown"

export interface SyncPreferences {
  syncMode: SyncMode
  syncNetworkPolicy: SyncNetworkPolicy
}

interface SyncPreferencesState extends SyncPreferences {
  hydrated: boolean
}

const STORAGE_KEY = "VELO_SYNC_PREFERENCES_V1"

const DEFAULT_PREFERENCES: SyncPreferences = {
  syncMode: "manual",
  syncNetworkPolicy: "any",
}

let state: SyncPreferencesState = {
  ...DEFAULT_PREFERENCES,
  hydrated: false,
}

const listeners = new Set<() => void>()
let hydratePromise: Promise<SyncPreferences> | null = null

function emit() {
  listeners.forEach((listener) => listener())
}

function setState(partial: Partial<SyncPreferencesState>) {
  const next = { ...state, ...partial }
  if (
    next.syncMode === state.syncMode &&
    next.syncNetworkPolicy === state.syncNetworkPolicy &&
    next.hydrated === state.hydrated
  ) {
    return
  }
  state = next
  emit()
}

async function persistPreferences(preferences: SyncPreferences) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export function getSyncPreferencesState() {
  return state
}

export function subscribeSyncPreferences(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function loadSyncPreferences() {
  if (state.hydrated) return getSyncPreferences()
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setState({ hydrated: true })
        return getSyncPreferences()
      }

      const parsed = JSON.parse(raw) as Partial<SyncPreferences> | null
      const next: SyncPreferences = {
        syncMode: parsed?.syncMode === "automatic" ? "automatic" : "manual",
        syncNetworkPolicy: parsed?.syncNetworkPolicy === "wifi_only" ? "wifi_only" : "any",
      }
      setState({ ...next, hydrated: true })
      return next
    } catch {
      setState({ hydrated: true })
      return getSyncPreferences()
    } finally {
      hydratePromise = null
    }
  })()

  return hydratePromise
}

export function getSyncPreferences(): SyncPreferences {
  return {
    syncMode: state.syncMode,
    syncNetworkPolicy: state.syncNetworkPolicy,
  }
}

export async function setSyncMode(syncMode: SyncMode) {
  const next = { ...getSyncPreferences(), syncMode }
  setState({ ...next, hydrated: true })
  await persistPreferences(next)
}

export async function setSyncNetworkPolicy(syncNetworkPolicy: SyncNetworkPolicy) {
  const next = { ...getSyncPreferences(), syncNetworkPolicy }
  setState({ ...next, hydrated: true })
  await persistPreferences(next)
}

export function useSyncPreferences() {
  return useSyncExternalStore(
    subscribeSyncPreferences,
    getSyncPreferencesState,
    getSyncPreferencesState,
  )
}

export function isAutomaticSyncAllowed(params: {
  preferences: SyncPreferences
  isOnline: boolean
  connectionType: SyncConnectionType
}) {
  if (!params.isOnline) return false
  if (params.preferences.syncMode !== "automatic") return false
  if (params.preferences.syncNetworkPolicy === "any") return true
  return params.connectionType === "wifi" || params.connectionType === "ethernet"
}

export function describeSyncBehavior(params: {
  preferences: SyncPreferences
  isOnline: boolean
  connectionType: SyncConnectionType
}) {
  const { preferences, isOnline, connectionType } = params

  if (preferences.syncMode === "manual") {
    return "Changes sync only when you trigger sync."
  }

  if (!isOnline) {
    return preferences.syncNetworkPolicy === "wifi_only"
      ? "Queued changes will sync when Wi-Fi is available."
      : "Queued changes will sync when internet connection returns."
  }

  if (preferences.syncNetworkPolicy === "wifi_only") {
    return connectionType === "wifi" || connectionType === "ethernet"
      ? "Changes sync automatically when Wi-Fi is available."
      : "Queued changes will sync when Wi-Fi is available."
  }

  return "Changes sync automatically when connection is available."
}
