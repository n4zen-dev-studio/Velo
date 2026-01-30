import NetInfo, { type NetInfoSubscription } from "@react-native-community/netinfo"

import {
  getSyncState,
  refreshLocalCounts,
  setLastError,
  setLastSyncedAt,
  setOnlineStatus,
  setPhase,
} from "@/services/sync/syncStore"
import { runSync } from "@/services/sync/SyncEngine"
import { normalizeSyncError } from "@/services/sync/syncErrors"

export type SyncTriggerReason = "app_open" | "manual" | "net_regain" | "background" | "app_resume"

class SyncController {
  private isRunning = false
  private netInfoUnsubscribe: NetInfoSubscription | null = null
  private appStateUnsubscribe: { remove: () => void } | null = null
  private lastTriggerAt = 0
  private pendingTrigger = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly minIntervalMs = 15000

  async initialize() {
    if (this.netInfoUnsubscribe) return

    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable)
      setOnlineStatus(online)
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

    const initialState = await NetInfo.fetch()
    setOnlineStatus(!!(initialState.isConnected && initialState.isInternetReachable))
    await refreshLocalCounts()
    void this.triggerSync("app_open")
  }

  async triggerSync(reason: SyncTriggerReason) {
    if (this.isRunning) {
      this.pendingTrigger = true
      return
    }
    const now = Date.now()
    if (now - this.lastTriggerAt < this.minIntervalMs) {
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
      const { isOnline } = getSyncState()
      if (!isOnline) {
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
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }
}

export const syncController = new SyncController()
