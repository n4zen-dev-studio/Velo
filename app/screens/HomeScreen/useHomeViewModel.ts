import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFocusEffect } from "@react-navigation/native"

import { listStatuses, listTasksByWorkspace } from "@/services/db"
import { updateTaskStatusOnly } from "@/services/db/taskMutations"
import type { Status, Task } from "@/services/db/types"
import { hasOpenConflict } from "@/services/db/repositories/conflictsRepository"
import { getCurrentUserId } from "@/services/sync/identity"
import { syncController } from "@/services/sync/SyncController"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"


export const useHomeViewModel = () => {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, refreshWorkspaces } = useWorkspaceStore()
  const [statuses, setStatuses] = useState<Status[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUserId, setLastUserId] = useState<string | null>(null)

  type BumpDir = "up" | "down"

  const tasksByStatus = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: tasks.filter((task) => task.statusId === status.id),
    }))
  }, [statuses, tasks])

  const tasksByStatusRef = useRef(tasksByStatus)

  useEffect(() => {
    tasksByStatusRef.current = tasksByStatus
  }, [tasksByStatus])

  const bumpTaskStatus = useCallback(
    async (taskId: string, laneIndex: number, dir: BumpDir) => {
      const lanes = tasksByStatusRef.current
      const lanesCount = lanes.length
      if (laneIndex < 0 || laneIndex >= lanesCount) {
        console.warn("[Home] bumpTaskStatus invalid laneIndex", {
          taskId,
          laneIndex,
          lanesCount,
        })
        return
      }

      const currentLane = lanes[laneIndex]
      const laneTask = currentLane?.tasks.find((t) => t.id === taskId)
      const fallbackTask = lanes.flatMap((lane) => lane.tasks).find((t) => t.id === taskId)
      const currentTask = laneTask ?? fallbackTask
      if (!currentTask) {
        console.warn("[Home] bumpTaskStatus task not found in lanes", { taskId, laneIndex })
        return
      }

      const currentStatusId = currentTask.statusId
      const currentProjectId = currentTask.projectId ?? null
      const currentWorkspaceId = currentTask.workspaceId ?? currentLane?.status.workspaceId
      const lanesForProject = lanes.filter((lane) => {
        const laneProjectId = lane.status.projectId ?? null
        return laneProjectId === currentProjectId && lane.status.workspaceId === currentWorkspaceId
      })

      const groupLaneIndex = lanesForProject.findIndex((lane) => lane.status.id === currentStatusId)
      if (groupLaneIndex < 0) {
        console.warn("[Home] bumpTaskStatus lane mismatch", {
          taskId,
          laneIndex,
          currentStatusId,
          currentProjectId,
          currentWorkspaceId,
          lanesForProject: lanesForProject.map((lane) => lane.status.id),
        })
        return
      }

      const targetIndex = dir === "up" ? groupLaneIndex - 1 : groupLaneIndex + 1
      if (targetIndex < 0 || targetIndex >= lanesForProject.length) {
        console.warn("[Home] bumpTaskStatus target out of bounds", {
          taskId,
          laneIndex,
          dir,
          targetIndex,
          lanesCount: lanesForProject.length,
        })
        return
      }

      const targetStatusId = lanesForProject[targetIndex].status.id
      console.log("[Home] bumpTaskStatus", {
        taskId,
        laneIndex,
        lanesCount,
        dir,
        currentStatusId,
        groupLaneIndex,
        targetIndex,
        targetStatusId,
      })

      const hasConflict = await hasOpenConflict("task", taskId)
      if (hasConflict) {
        console.warn("[Home] bumpTaskStatus blocked by conflict", { taskId })
        return
      }

      try {
        await updateTaskStatusOnly(taskId, targetStatusId)
        await refreshAll()

        const refreshedLanes = tasksByStatusRef.current
        const updatedLane = refreshedLanes.find((lane) => lane.tasks.some((t) => t.id === taskId))
        console.log("[Home] bumpTaskStatus refreshed", {
          taskId,
          statusId: updatedLane?.status.id,
          laneName: updatedLane?.status.name,
        })
      } catch (e) {
        console.warn("[Home] bumpTaskStatus failed", e)
      }
    },
    [refreshAll],
  )


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
      let isActive = true

      const run = async () => {
        void loadStatuses()
        void loadTasks()

        const currentUserId = await getCurrentUserId()
        if (!isActive) return

        if (lastUserId && currentUserId && lastUserId !== currentUserId) {
          await refreshAll()
        }

        if (currentUserId !== lastUserId) {
          setLastUserId(currentUserId ?? null)
        }
      }

      void run()

      return () => {
        isActive = false
      }
    }, [loadStatuses, loadTasks, refreshAll, lastUserId]),
  )

  return {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    tasksByStatus,
    refreshAll,
    isRefreshing,
    bumpTaskStatus,
  }
}
