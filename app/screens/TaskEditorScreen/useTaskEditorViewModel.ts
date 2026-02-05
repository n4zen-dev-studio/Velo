import { useCallback, useEffect, useMemo, useState } from "react"

import { getProjectById, getTaskById, listStatuses, upsertTask } from "@/services/db"
import type { Priority, Status, Task } from "@/services/db/types"
import { generateUuidV4, getCurrentUserId } from "@/services/sync/identity"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { getActiveScopeKey } from "@/services/session/scope"

export const useTaskEditorViewModel = (taskId?: string, projectId?: string) => {
  const { activeWorkspaceId } = useWorkspaceStore()
  const [task, setTask] = useState<Task | null>(null)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId)
  const [isSaving, setIsSaving] = useState(false)

  const effectiveProjectId = task?.projectId ?? projectId ?? null

  const load = useCallback(async () => {
    let resolvedWorkspaceId = activeWorkspaceId
    if (taskId) {
      const existing = await getTaskById(taskId)
      setTask(existing)
      if (existing?.workspaceId) {
        resolvedWorkspaceId = existing.workspaceId
      }
    }
    if (!taskId && projectId) {
      const project = await getProjectById(projectId)
      if (project?.workspaceId) {
        resolvedWorkspaceId = project.workspaceId
      }
    }
    setWorkspaceId(resolvedWorkspaceId)
    const statusRows = await listStatuses(resolvedWorkspaceId, effectiveProjectId)
    setStatuses(statusRows)
  }, [taskId, effectiveProjectId, projectId, activeWorkspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const priorityOptions: Priority[] = ["low", "medium", "high"]

  const saveTask = useCallback(
    async (values: { title: string; description: string; statusId: string; priority: Priority }) => {
      setIsSaving(true)
      const now = new Date().toISOString()
      const currentUserId = await getCurrentUserId()
      const scopeKey = await getActiveScopeKey()
      const nextRevision = task?.revision
        ? `${task.revision}-${Date.now()}`
        : `rev-${Date.now()}`

      const payload: Task = {
        id: task?.id ?? (await generateUuidV4()),
        projectId: effectiveProjectId,
        workspaceId,
        title: values.title,
        description: values.description,
        statusId: values.statusId,
        priority: values.priority,
        assigneeUserId: effectiveProjectId ? null : currentUserId,
        createdByUserId: task?.createdByUserId ?? currentUserId,
        updatedAt: now,
        revision: nextRevision,
        deletedAt: null,
        scopeKey,
      }

      await upsertTask(payload)
      await refreshLocalCounts()
      setIsSaving(false)
      return payload
    },
    [effectiveProjectId, task, workspaceId],
  )

  const defaultValues = useMemo(() => {
    return {
      title: task?.title ?? "",
      description: task?.description ?? "",
      statusId: task?.statusId ?? statuses[0]?.id ?? "",
      priority: task?.priority ?? "medium",
    }
  }, [task, statuses])

  return {
    task,
    statuses,
    priorityOptions,
    defaultValues,
    saveTask,
    isSaving,
  }
}
