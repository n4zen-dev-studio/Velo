import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFocusEffect } from "@react-navigation/native"

import { listStatuses, listTasksByWorkspace } from "@/services/db"
import { ensureDefaultStatusesForWorkspace } from "@/services/db/repositories/statusesRepository"
import { updateTaskStatusOnly } from "@/services/db/taskMutations"
import type { Status, Task } from "@/services/db/types"
import { hasOpenConflict } from "@/services/db/repositories/conflictsRepository"
import { personalWorkspaceId } from "@/services/db/repositories/workspacesRepository"
import { getActiveScopeKey, GUEST_SCOPE_KEY } from "@/services/session/scope"
import { getCurrentUserId } from "@/services/sync/identity"
import { resolveUserLabel } from "@/utils/userLabel"
import { syncController } from "@/services/sync/SyncController"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { createHttpClient } from "@/services/api/httpClient"
import { BASE_URL } from "@/config/api"
import { listWorkspaceMembers as listWorkspaceMembersApi } from "@/services/api/workspacesApi"
import { upsertUserFromSync } from "@/services/db/repositories/usersRepository"


export const useHomeViewModel = () => {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, refreshWorkspaces } = useWorkspaceStore()
  const [statuses, setStatuses] = useState<Status[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUserId, setLastUserId] = useState<string | null>(null)
  const [uiTasksByStatus, setUiTasksByStatus] = useState<Array<{ status: Status; tasks: Task[] }>>([])
  const [uiWorkspaceId, setUiWorkspaceId] = useState<string | null>(activeWorkspaceId ?? null)
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "mine">("all")
  const [assigneeLabels, setAssigneeLabels] = useState<Record<string, string>>({})
  const refreshingRef = useRef(false)
  const loadTokenRef = useRef(0)
  const lastValidWorkspaceIdRef = useRef<string | null>(null)
  const guestWorkspaceId = personalWorkspaceId(GUEST_SCOPE_KEY)

  type BumpDir = "up" | "down"

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null
  }, [activeWorkspaceId, workspaces])

  const filteredTasks = useMemo(() => {
    if (assigneeFilter !== "mine") return tasks
    if (!lastUserId) return tasks
    return tasks.filter((task) => task.assigneeUserId === lastUserId)
  }, [assigneeFilter, lastUserId, tasks])

  const tasksByStatus = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: filteredTasks.filter((task) => task.statusId === status.id),
    }))
  }, [filteredTasks, statuses])

  const uiTasksByStatusRef = useRef(uiTasksByStatus)

  useEffect(() => {
    if (uiWorkspaceId && uiWorkspaceId === activeWorkspaceId) {
      setUiTasksByStatus(tasksByStatus)
    }
  }, [tasksByStatus, uiWorkspaceId, activeWorkspaceId])

  useEffect(() => {
    uiTasksByStatusRef.current = uiTasksByStatus
  }, [uiTasksByStatus])

  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== guestWorkspaceId) {
      lastValidWorkspaceIdRef.current = activeWorkspaceId
    }
  }, [activeWorkspaceId, guestWorkspaceId])

  useEffect(() => {
    if (activeWorkspace?.kind === "personal" && assigneeFilter !== "all") {
      setAssigneeFilter("all")
    }
  }, [activeWorkspace?.kind, assigneeFilter])

  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.kind === "personal") return
    void (async () => {
      try {
        const client = createHttpClient(BASE_URL)
        const members = await listWorkspaceMembersApi(client, activeWorkspace.id)
        const scopeKey = await getActiveScopeKey()
        await Promise.all(
          members.map((member) => {
            if (!member.user) return Promise.resolve()
            return upsertUserFromSync({
              id: member.user.id,
              email: member.user.email ?? null,
              username: member.user.username ?? null,
              displayName: member.user.displayName ?? null,
              avatarUrl: member.user.avatarUrl ?? null,
              createdAt: member.user.createdAt,
              updatedAt: member.user.updatedAt,
              revision: member.user.revision,
              deletedAt: member.user.deletedAt ?? null,
              scopeKey,
            })
          }),
        )
        const assigneeIds = Array.from(
          new Set(tasks.map((task) => task.assigneeUserId).filter(Boolean) as string[]),
        )
        if (assigneeIds.length > 0) {
          const entries = await Promise.all(
            assigneeIds.map(async (userId) => [userId, await resolveUserLabel(userId)] as const),
          )
          setAssigneeLabels(Object.fromEntries(entries))
        }
      } catch {
        // Member labels fall back to cached users when offline.
      }
    })()
  }, [activeWorkspace, tasks])

  useEffect(() => {
    const assigneeIds = Array.from(
      new Set(tasks.map((task) => task.assigneeUserId).filter(Boolean) as string[]),
    )
    if (assigneeIds.length === 0) {
      setAssigneeLabels({})
      return
    }
    let isActive = true
    void (async () => {
      const entries = await Promise.all(
        assigneeIds.map(async (userId) => [userId, await resolveUserLabel(userId)] as const),
      )
      if (!isActive) return
      setAssigneeLabels(Object.fromEntries(entries))
    })()
    return () => {
      isActive = false
    }
  }, [tasks])

  const getEffectiveWorkspaceId = useCallback(() => {
    if (activeWorkspaceId === guestWorkspaceId && lastValidWorkspaceIdRef.current) {
      console.warn("[Home] Using last valid workspace during guest fallback", {
        activeWorkspaceId,
        lastValidWorkspaceId: lastValidWorkspaceIdRef.current,
      })
      return lastValidWorkspaceIdRef.current
    }
    return activeWorkspaceId
  }, [activeWorkspaceId, guestWorkspaceId])

  const bumpTaskStatus = useCallback(
    async (taskId: string, laneIndex: number, dir: BumpDir) => {
      const effectiveWorkspaceId = getEffectiveWorkspaceId()
      const lanes = uiTasksByStatusRef.current
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
      if (effectiveWorkspaceId && currentWorkspaceId && currentWorkspaceId !== effectiveWorkspaceId) {
        console.warn("[Home] bumpTaskStatus workspace mismatch", {
          taskId,
          currentWorkspaceId,
          activeWorkspaceId: effectiveWorkspaceId,
        })
        return
      }
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

      const targetLane = lanesForProject[targetIndex]
      const targetStatusId = targetLane.status.id
      const targetLaneIndex = lanes.findIndex((lane) => {
        const laneProjectId = lane.status.projectId ?? null
        return (
          lane.status.id === targetStatusId &&
          laneProjectId === currentProjectId &&
          lane.status.workspaceId === currentWorkspaceId
        )
      })
      if (targetLaneIndex < 0) {
        console.warn("[Home] bumpTaskStatus target lane not found", {
          taskId,
          laneIndex,
          targetStatusId,
          currentProjectId,
          currentWorkspaceId,
        })
        return
      }
      console.log("[Home] bumpTaskStatus", {
        taskId,
        laneIndex,
        lanesCount,
        dir,
        currentStatusId,
        groupLaneIndex,
        targetIndex,
        targetLaneIndex,
        targetStatusId,
      })

      const hasConflict = await hasOpenConflict("task", taskId)
      if (hasConflict) {
        console.warn("[Home] bumpTaskStatus blocked by conflict", { taskId })
        return
      }

      const prevUiLanes = uiTasksByStatusRef.current
      const nextUiLanes = prevUiLanes.map((lane) => ({
        status: lane.status,
        tasks: lane.tasks.slice(),
      }))
      const fromLane = nextUiLanes[laneIndex]
      const taskIndex = fromLane.tasks.findIndex((t) => t.id === taskId)
      if (taskIndex < 0) {
        console.warn("[Home] bumpTaskStatus missing task in optimistic lane", { taskId, laneIndex })
        return
      }
      const [movedTask] = fromLane.tasks.splice(taskIndex, 1)
      const updatedTask = { ...movedTask, statusId: targetStatusId }
      nextUiLanes[targetLaneIndex].tasks.unshift(updatedTask)
      console.log("[Home] bumpTaskStatus optimistic", {
        taskId,
        lanesCount,
        fromLane: laneIndex,
        toLane: targetLaneIndex,
        fromCount: prevUiLanes[laneIndex]?.tasks.length,
        toCount: prevUiLanes[targetLaneIndex]?.tasks.length,
      })
      setUiTasksByStatus(nextUiLanes)

      try {
        await updateTaskStatusOnly(taskId, targetStatusId)
        await refreshAll({ mode: "soft" })

        const refreshedLanes = uiTasksByStatusRef.current
        const updatedLane = refreshedLanes.find((lane) => lane.tasks.some((t) => t.id === taskId))
        console.log("[Home] bumpTaskStatus refreshed", {
          taskId,
          statusId: updatedLane?.status.id,
          laneName: updatedLane?.status.name,
        })
      } catch (e) {
        setUiTasksByStatus(prevUiLanes)
        console.warn("[Home] bumpTaskStatus failed", e)
      }
    },
    [getEffectiveWorkspaceId, refreshAll],
  )


  const loadDataForWorkspace = useCallback(async (workspaceId: string, token: number) => {
    console.log("[Home] load start", { workspaceId, token })
    let [statusRows, taskRows] = await Promise.all([
      listStatuses(workspaceId, null),
      listTasksByWorkspace(workspaceId),
    ])

    if (statusRows.length === 0) {
      const workspace = workspaces.find((item) => item.id === workspaceId)
      if (workspace && workspace.kind !== "personal") {
        await ensureDefaultStatusesForWorkspace(workspaceId, workspace.scopeKey)
        statusRows = await listStatuses(workspaceId, null)
      }
    }

    if (token !== loadTokenRef.current || workspaceId !== getEffectiveWorkspaceId()) {
      console.log("[Home] load stale", { workspaceId, token })
      return
    }

    const seen = new Set<string>()
    const uniqueStatuses = statusRows.filter((s) => {
      const key = `${s.workspaceId}:${s.projectId ?? "personal"}:${s.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setStatuses(uniqueStatuses)
    setTasks(taskRows)
    setUiWorkspaceId(workspaceId)
    console.log("[Home] load end", {
      workspaceId,
      token,
      statuses: uniqueStatuses.length,
      tasks: taskRows.length,
    })
  }, [getEffectiveWorkspaceId, workspaces])

  const refreshAll = useCallback(
    async (options?: { mode?: "soft" | "hard" }) => {
      if (refreshingRef.current) return
      refreshingRef.current = true
      const mode = options?.mode ?? "hard"
      const lanesCountBefore = uiTasksByStatusRef.current.length
      const scopeKey = await getActiveScopeKey()
      console.log("[Home] refreshAll start", {
        mode,
        activeWorkspaceId,
        scopeKey,
        lanesCountBefore,
      })
      setIsRefreshing(true)
      try {
        const workspaceId = getEffectiveWorkspaceId()
        if (workspaceId) {
          const token = ++loadTokenRef.current
          if (mode === "hard") {
            await Promise.all([refreshWorkspaces(), loadDataForWorkspace(workspaceId, token), refreshLocalCounts()])
          } else {
            await Promise.all([loadDataForWorkspace(workspaceId, token), refreshLocalCounts()])
          }
        }
      } finally {
        setIsRefreshing(false)
        refreshingRef.current = false
        const lanesCountAfter = uiTasksByStatusRef.current.length
        console.log("[Home] refreshAll end", {
          mode,
          activeWorkspaceId,
          scopeKey,
          lanesCountAfter,
        })
      }
    },
    [activeWorkspaceId, getEffectiveWorkspaceId, loadDataForWorkspace, refreshWorkspaces],
  )

  const syncNow = useCallback(
    async (reason: "manual" | "auto" | string = "manual") => {
      if (refreshingRef.current) return
      refreshingRef.current = true
      setIsRefreshing(true)
      try {
        await syncController.triggerSync(reason)
        const workspaceId = getEffectiveWorkspaceId()
        if (workspaceId) {
          const token = ++loadTokenRef.current
          await Promise.all([refreshWorkspaces(), loadDataForWorkspace(workspaceId, token), refreshLocalCounts()])
        }
      } finally {
        setIsRefreshing(false)
        refreshingRef.current = false
      }
    },
    [activeWorkspaceId, getEffectiveWorkspaceId, loadDataForWorkspace, refreshWorkspaces],
  )

  useEffect(() => {
    const workspaceId = getEffectiveWorkspaceId()
    if (!workspaceId) return
    const token = ++loadTokenRef.current
    void loadDataForWorkspace(workspaceId, token)
  }, [activeWorkspaceId, getEffectiveWorkspaceId, loadDataForWorkspace])

  useFocusEffect(
    useCallback(() => {
      let isActive = true

      const run = async () => {
        const workspaceId = getEffectiveWorkspaceId()
        if (workspaceId) {
          const token = ++loadTokenRef.current
          void loadDataForWorkspace(workspaceId, token)
        }

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
    }, [activeWorkspaceId, getEffectiveWorkspaceId, loadDataForWorkspace, refreshAll, lastUserId]),
  )

  useEffect(() => {
    console.log("[Workspace] activeWorkspaceId", activeWorkspaceId)
  }, [activeWorkspaceId])

  return {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    tasksByStatus,
    uiTasksByStatus,
    uiWorkspaceId,
    activeWorkspace,
    assigneeFilter,
    setAssigneeFilter,
    assigneeLabels,
    refreshAll,
    syncNow,
    isRefreshing,
    bumpTaskStatus,
  }
}
