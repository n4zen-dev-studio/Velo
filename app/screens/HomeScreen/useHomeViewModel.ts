import { useMemo, useState } from "react"

import type { SyncStatus } from "@/components/SyncStatusBadge"

import { homeMockData } from "./homeMockData"
import type { Workspace } from "./types"

export const useHomeViewModel = () => {
  const { workspaces, statuses, tasks } = homeMockData
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id ?? "personal")
  const [syncStatus] = useState<SyncStatus>("syncing")

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0],
    [activeWorkspaceId, workspaces],
  )

  const filteredTasks = useMemo(() => {
    if (!activeWorkspace) return []
    return tasks.filter((task) => task.projectId === activeWorkspace.projectId)
  }, [activeWorkspace, tasks])

  const tasksByStatus = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: filteredTasks.filter((task) => task.statusId === status.id),
    }))
  }, [filteredTasks, statuses])

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    syncStatus,
    tasksByStatus,
  }
}
