import { useCallback, useEffect, useMemo, useState } from "react"
import { useFocusEffect } from "@react-navigation/native"

import { listStatuses, listTasksByWorkspace } from "@/services/db"
import type { Status, Task } from "@/services/db/types"
import { syncController } from "@/services/sync/SyncController"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"

export const useHomeViewModel = () => {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, refreshWorkspaces } = useWorkspaceStore()
  const [statuses, setStatuses] = useState<Status[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadStatuses = useCallback(async () => {
    if (!activeWorkspaceId) return
    const rows = await listStatuses(activeWorkspaceId, null)

    const seen = new Set<string>()
    const unique = rows.filter((s) => {
      const key = `${s.workspaceId}:${s.projectId ?? "personal"}:${s.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setStatuses(unique)
  }, [activeWorkspaceId])

  const loadTasks = useCallback(async () => {
    if (!activeWorkspaceId) return
    const taskRows = await listTasksByWorkspace(activeWorkspaceId)
    setTasks(taskRows)
  }, [activeWorkspaceId])

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true)
    await syncController.triggerSync("manual")
    await Promise.all([refreshWorkspaces(), loadStatuses(), loadTasks(), refreshLocalCounts()])
    setIsRefreshing(false)
  }, [loadStatuses, loadTasks, refreshWorkspaces])

  useEffect(() => {
    setStatuses([])
    setTasks([])
    void loadStatuses()
    void loadTasks()
  }, [activeWorkspaceId, loadStatuses, loadTasks])

  useFocusEffect(
    useCallback(() => {
      void loadStatuses()
      void loadTasks()
    }, [loadStatuses, loadTasks]),
  )

  const tasksByStatus = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: tasks.filter((task) => task.statusId === status.id),
    }))
  }, [statuses, tasks])

  return {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    tasksByStatus,
    refreshAll,
    isRefreshing,
  }
}
