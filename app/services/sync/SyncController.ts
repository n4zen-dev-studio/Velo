import NetInfo, { type NetInfoSubscription } from "@react-native-community/netinfo"

import { getAccessToken } from "@/services/api/tokenStore"
import { getSessionMode, getStoredUserId } from "@/services/sync/identity"
import { runSync } from "@/services/sync/SyncEngine"
import { normalizeSyncError } from "@/services/sync/syncErrors"
import {
  getSyncPreferences,
  isAutomaticSyncAllowed,
  loadSyncPreferences,
  subscribeSyncPreferences,
} from "@/services/sync/syncPreferences"
import { subscribeQueuedSyncChange } from "@/services/sync/syncQueueNotifications"
import {
  getSyncState,
  refreshLocalCounts,
  setLastError,
  setLastSyncedAt,
  setNetworkType,
  setOnlineStatus,
  setPhase,
} from "@/services/sync/syncStore"

export type SyncTriggerReason =
  | "app_open"
  | "manual"
  | "net_regain"
  | "background"
  | "app_resume"
  | "auth_bootstrap"
  | "local_change"
  | "preferences_change"

class SyncController {
  private isRunning = false
  private isPaused = false
  private netInfoUnsubscribe: NetInfoSubscription | null = null
  private appStateUnsubscribe: { remove: () => void } | null = null
  private preferencesUnsubscribe: (() => void) | null = null
  private queueChangeUnsubscribe: (() => void) | null = null
  private lastTriggerAt = 0
  private pendingTrigger = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly minIntervalMs = 15000

  async initialize() {
    if (this.netInfoUnsubscribe) return
    await loadSyncPreferences()

    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      this.updateConnectivity(state)
      const online = !!(state.isConnected && state.isInternetReachable)
      if (online) {
        void this.triggerSync("net_regain")
      }
    })

    const AppState = await import("react-native").then((mod) => mod.AppState)
    this.appStateUnsubscribe = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void this.triggerSync("app_resume")
      }
    })

    this.preferencesUnsubscribe = subscribeSyncPreferences(() => {
      void this.triggerSync("preferences_change")
    })

    this.queueChangeUnsubscribe = subscribeQueuedSyncChange(() => {
      void refreshLocalCounts()
      void this.triggerSync("local_change")
    })

    const initialState = await NetInfo.fetch()
    this.updateConnectivity(initialState)
    await refreshLocalCounts()
    void this.triggerSync("app_open")
  }

  async triggerSync(reason: SyncTriggerReason) {
    if (this.isPaused) {
      setPhase("idle")
      return
    }
    if (this.isRunning) {
      this.pendingTrigger = true
      return
    }
    const shouldBypassDebounce = reason === "manual" || reason === "auth_bootstrap"
    const now = Date.now()
    if (!shouldBypassDebounce && now - this.lastTriggerAt < this.minIntervalMs) {
      this.pendingTrigger = true
      if (!this.debounceTimer) {
        const waitMs = this.minIntervalMs - (now - this.lastTriggerAt)
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null
          if (this.pendingTrigger) {
            this.pendingTrigger = false
            void this.triggerSync(reason)
          }
        }, waitMs)
      }
      return
    }
    this.isRunning = true

    try {
      this.lastTriggerAt = now
      const sessionMode = await getSessionMode()
      if (sessionMode === "local") {
        setPhase("idle")
        return
      }
      const accessToken = await getAccessToken()
      const userId = await getStoredUserId()
      if (!accessToken || !userId) {
        setPhase("idle")
        return
      }
      const snapshot = getSyncState()
      const { isOnline, networkType } = snapshot
      if (!isOnline) {
        await refreshLocalCounts()
        setPhase("idle")
        return
      }
      if (
        reason !== "manual" &&
        reason !== "auth_bootstrap" &&
        !isAutomaticSyncAllowed({
          preferences: getSyncPreferences(),
          isOnline,
          connectionType: networkType,
        })
      ) {
        await refreshLocalCounts()
        setPhase("idle")
        return
      }
      setPhase("syncing")
      void reason
      await runSync(reason)
      setLastSyncedAt(new Date().toISOString())
      setPhase("idle")
      setLastError(null)
    } catch (error) {
      setLastError(normalizeSyncError(error))
      setPhase("error")
    } finally {
      this.isRunning = false
      if (this.pendingTrigger) {
        this.pendingTrigger = false
        void this.triggerSync(reason)
      }
    }
  }

  dispose() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe()
      this.netInfoUnsubscribe = null
    }
    if (this.appStateUnsubscribe) {
      this.appStateUnsubscribe.remove()
      this.appStateUnsubscribe = null
    }
    if (this.preferencesUnsubscribe) {
      this.preferencesUnsubscribe()
      this.preferencesUnsubscribe = null
    }
    if (this.queueChangeUnsubscribe) {
      this.queueChangeUnsubscribe()
      this.queueChangeUnsubscribe = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  pause() {
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
  }

  private updateConnectivity(state: {
    isConnected: boolean | null
    isInternetReachable: boolean | null
    type?: string
  }) {
    const online = !!(state.isConnected && state.isInternetReachable)
    const type = state.type ?? "unknown"
    const networkType =
      type === "wifi" || type === "cellular" || type === "ethernet"
        ? type
        : online
          ? "other"
          : "none"

    setOnlineStatus(online)
    setNetworkType(networkType)
  }
}

export const syncController = new SyncController()
