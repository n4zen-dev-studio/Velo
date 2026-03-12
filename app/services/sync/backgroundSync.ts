import * as BackgroundFetch from "expo-background-fetch"
import * as TaskManager from "expo-task-manager"
import NetInfo from "@react-native-community/netinfo"

import { syncController } from "@/services/sync/SyncController"
import { loadSyncPreferences } from "@/services/sync/syncPreferences"
import { logSync } from "@/utils/logger"

export const BACKGROUND_SYNC_TASK = "TASKTRAK_SYNC"

let registered = false

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await loadSyncPreferences()
    const state = await NetInfo.fetch()
    if (!state.isConnected || !state.isInternetReachable) {
      return BackgroundFetch.BackgroundFetchResult.NoData
    }
    await syncController.triggerSync("background")
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch (error) {
    logSync("background sync failed", { error })
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

export async function registerBackgroundSync() {
  if (registered) return
  registered = true

  const status = await BackgroundFetch.getStatusAsync()
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return
  }

  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  })
  logSync("background sync registered")
}
