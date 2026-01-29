import { useCallback, useEffect, useMemo, useState } from "react"

import { getTaskById, listStatuses, upsertTask } from "@/services/db"
import type { Priority, Status, Task } from "@/services/db/types"
import { generateUuidV4, getCurrentUserId } from "@/services/sync/identity"
import { refreshLocalCounts } from "@/services/sync/syncStore"

export const useTaskEditorViewModel = (taskId?: string, projectId?: string) => {
  const [task, setTask] = useState<Task | null>(null)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const effectiveProjectId = task?.projectId ?? projectId ?? null

  const load = useCallback(async () => {
    if (taskId) {
      const existing = await getTaskById(taskId)
      setTask(existing)
    }
    const statusRows = await listStatuses(effectiveProjectId)
    setStatuses(statusRows)
  }, [taskId, effectiveProjectId])

  useEffect(() => {
    void load()
  }, [load])

  const priorityOptions: Priority[] = ["low", "medium", "high"]

  const saveTask = useCallback(
    async (values: { title: string; description: string; statusId: string; priority: Priority }) => {
      setIsSaving(true)
      const now = new Date().toISOString()
      const currentUserId = await getCurrentUserId()
      const nextRevision = task?.revision
        ? `${task.revision}-${Date.now()}`
        : `rev-${Date.now()}`

      const payload: Task = {
        id: task?.id ?? (await generateUuidV4()),
        projectId: effectiveProjectId,
        title: values.title,
        description: values.description,
        statusId: values.statusId,
        priority: values.priority,
        assigneeUserId: effectiveProjectId ? null : currentUserId,
        createdByUserId: task?.createdByUserId ?? currentUserId,
        updatedAt: now,
        revision: nextRevision,
        deletedAt: null,
      }

      await upsertTask(payload)
      await refreshLocalCounts()
      setIsSaving(false)
      return payload
    },
    [effectiveProjectId, task],
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
