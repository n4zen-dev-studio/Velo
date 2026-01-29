import NetInfo, { type NetInfoSubscription } from "@react-native-community/netinfo"

import {
  getSyncState,
  refreshLocalCounts,
  setLastError,
  setLastSyncedAt,
  setOnlineStatus,
  setPhase,
} from "@/services/sync/syncStore"

export type SyncTriggerReason = "app_open" | "manual" | "net_regain"

class SyncController {
  private isRunning = false
  private netInfoUnsubscribe: NetInfoSubscription | null = null

  async initialize() {
    if (this.netInfoUnsubscribe) return

    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable)
      setOnlineStatus(online)
      if (online) {
        void this.triggerSync("net_regain")
      }
    })

    const initialState = await NetInfo.fetch()
    setOnlineStatus(!!(initialState.isConnected && initialState.isInternetReachable))
    await refreshLocalCounts()
    void this.triggerSync("app_open")
  }

  async triggerSync(reason: SyncTriggerReason) {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const { isOnline } = getSyncState()
      if (!isOnline) {
        await refreshLocalCounts()
        setPhase("idle")
        return
      }
      setPhase("syncing")
      await refreshLocalCounts()

      // TODO: Push local ops + pull delta changes when backend sync is implemented.
      void reason

      setLastSyncedAt(new Date().toISOString())
      setPhase("idle")
      setLastError(null)
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Unknown sync error")
      setPhase("error")
    } finally {
      this.isRunning = false
    }
  }

  dispose() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe()
      this.netInfoUnsubscribe = null
    }
  }
}

export const syncController = new SyncController()
