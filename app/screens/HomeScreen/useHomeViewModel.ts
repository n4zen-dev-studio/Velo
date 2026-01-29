import { useCallback, useEffect, useMemo, useState } from "react"
import { useFocusEffect } from "@react-navigation/native"

import type { WorkspaceOption } from "@/components/WorkspaceSwitcher"
import { listProjects, listStatuses, listTasksByWorkspace } from "@/services/db"
import type { Project, Status, Task } from "@/services/db/types"
import { syncController } from "@/services/sync/SyncController"
import { refreshLocalCounts } from "@/services/sync/syncStore"

export const useHomeViewModel = () => {
  const [workspaces, setWorkspaces] = useState<(WorkspaceOption & { projectId: string | null })[]>([
    { id: "personal", label: "Personal", subtitle: "Personal", projectId: null },
  ])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("personal")
  const [projects, setProjects] = useState<Project[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const activeProjectId = useMemo(() => {
    if (activeWorkspaceId === "personal") return null
    return activeWorkspaceId
  }, [activeWorkspaceId])

  const loadWorkspaces = useCallback(async () => {
    const projectRows = await listProjects()
    setProjects(projectRows)
    setWorkspaces([
      { id: "personal", label: "Personal", subtitle: "Personal", projectId: null },
      ...projectRows.map((project) => ({
        id: project.id,
        label: project.name,
        subtitle: "Project",
        projectId: project.id,
      })),
    ])
  }, [])

  const loadStatuses = useCallback(async () => {
    const rows = await listStatuses(activeProjectId)

    const seen = new Set<string>()
    const unique = rows.filter((s) => {
      const key = `${s.projectId ?? "personal"}:${s.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setStatuses(unique)
  }, [activeProjectId])

  const loadTasks = useCallback(async () => {
    const taskRows = await listTasksByWorkspace(activeProjectId)
    setTasks(taskRows)
  }, [activeProjectId])

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true)
    await syncController.triggerSync("manual")
    await Promise.all([loadWorkspaces(), loadStatuses(), loadTasks(), refreshLocalCounts()])
    setIsRefreshing(false)
  }, [loadStatuses, loadTasks, loadWorkspaces])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  useEffect(() => {
    void loadStatuses()
    void loadTasks()
  }, [loadStatuses, loadTasks])

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
    projects,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeProjectId,
    tasksByStatus,
    refreshAll,
    isRefreshing,
  }
}
