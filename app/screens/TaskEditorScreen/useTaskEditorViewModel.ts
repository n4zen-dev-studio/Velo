import { useCallback, useEffect, useMemo, useState } from "react"

import { BASE_URL } from "@/config/api"
import { createHttpClient } from "@/services/api/httpClient"
import { listWorkspaceMembers as listWorkspaceMembersApi } from "@/services/api/workspacesApi"
import {
  getProjectById,
  getTaskById,
  listStatuses,
  listTaskAttachments,
  replaceTaskAttachments,
  upsertTask,
} from "@/services/db"
import { upsertUserFromSync } from "@/services/db/repositories/usersRepository"
import { listByWorkspaceId as listWorkspaceMembers } from "@/services/db/repositories/workspaceMembersRepository"
import { resolveWorkspaceScopeKey } from "@/services/db/scopeKey"
import type { Priority, Status, Task, TaskAttachment } from "@/services/db/types"
import { getActiveScopeKey } from "@/services/session/scope"
import { generateUuidV4, getCurrentUserId } from "@/services/sync/identity"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { resolveUserMeta } from "@/utils/userLabel"

export const useTaskEditorViewModel = (taskId?: string, projectId?: string) => {
  const { activeWorkspaceId } = useWorkspaceStore()
  const [task, setTask] = useState<Task | null>(null)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId)
  const [isSaving, setIsSaving] = useState(false)
  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ userId: string | null; label: string }>
  >([])
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])

  const effectiveProjectId = task?.projectId ?? projectId ?? null

  const loadAssignees = useCallback(async (workspaceId: string, currentUserId: string) => {
    const localMembers = await listWorkspaceMembers(workspaceId)
    if (localMembers.length > 0) {
      const options = await Promise.all(
        localMembers.map(async (member) => {
          const meta = await resolveUserMeta(member.userId)
          return { userId: member.userId, label: meta.label }
        }),
      )
      setAssigneeOptions([{ userId: null, label: "Unassigned" }, ...options])
    } else {
      setAssigneeOptions([
        { userId: null, label: "Unassigned" },
        { userId: currentUserId, label: "You" },
      ])
    }

    try {
      const client = createHttpClient(BASE_URL)
      const remoteMembers = await listWorkspaceMembersApi(client, workspaceId)
      if (remoteMembers.length > 0) {
        const options = remoteMembers.map((member) => {
          const user = member.user
          const label =
            user?.username?.trim() || user?.email?.trim() || user?.displayName?.trim() || "Member"
          return { userId: member.userId, label }
        })
        setAssigneeOptions([{ userId: null, label: "Unassigned" }, ...options])

        const scopeKey = await getActiveScopeKey()
        await Promise.all(
          remoteMembers.map((member) => {
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
      }
    } catch {
      // Network optional; fall back to local members.
    }
  }, [])

  const load = useCallback(async () => {
    let resolvedWorkspaceId = activeWorkspaceId
    const currentUserId = await getCurrentUserId()
    if (taskId) {
      const existing = await getTaskById(taskId)
      setTask(existing)
      if (existing?.workspaceId) {
        resolvedWorkspaceId = existing.workspaceId
      }
      setAssigneeUserId(existing?.assigneeUserId ?? currentUserId)
      if (existing) {
        setAttachments(await listTaskAttachments(existing.id))
      }
    }
    if (!taskId) {
      setAttachments([])
    }
    if (!taskId && projectId) {
      const project = await getProjectById(projectId)
      if (project?.workspaceId) {
        resolvedWorkspaceId = project.workspaceId
      }
    }
    if (!taskId) {
      setAssigneeUserId(currentUserId)
    }
    setWorkspaceId(resolvedWorkspaceId)
    await loadAssignees(resolvedWorkspaceId, currentUserId)
    const statusRows = await listStatuses(resolvedWorkspaceId, effectiveProjectId)
    setStatuses(statusRows)
  }, [taskId, effectiveProjectId, projectId, activeWorkspaceId, loadAssignees])

  useEffect(() => {
    void load()
  }, [load])

  const priorityOptions: Priority[] = ["low", "medium", "high"]

  const saveTask = useCallback(
    async (values: {
      title: string
      description: string
      statusId: string
      priority: Priority
      startDate: string | null
      endDate: string | null
    }) => {
      setIsSaving(true)
      const now = new Date().toISOString()
      const currentUserId = await getCurrentUserId()
      const scopeKey = await resolveWorkspaceScopeKey(workspaceId)
      const nextRevision = task?.revision ? `${task.revision}-${Date.now()}` : `rev-${Date.now()}`

      const payload: Task = {
        id: task?.id ?? (await generateUuidV4()),
        projectId: effectiveProjectId,
        workspaceId,
        title: values.title,
        description: values.description,
        statusId: values.statusId,
        priority: values.priority,
        assigneeUserId: assigneeUserId === null ? null : (assigneeUserId ?? currentUserId),
        createdByUserId: task?.createdByUserId ?? currentUserId,
        startDate: values.startDate,
        endDate: values.endDate,
        updatedAt: now,
        revision: nextRevision,
        deletedAt: null,
        scopeKey,
      }

      await upsertTask(payload)
      await replaceTaskAttachments(
        payload.id,
        workspaceId,
        attachments.map((attachment) => ({
          ...attachment,
          taskId: payload.id,
          workspaceId,
          updatedAt: now,
          scopeKey,
        })),
      )
      await refreshLocalCounts()
      setIsSaving(false)
      return payload
    },
    [assigneeUserId, attachments, effectiveProjectId, task, workspaceId],
  )

  const defaultValues = useMemo(() => {
    return {
      title: task?.title ?? "",
      description: task?.description ?? "",
      statusId: task?.statusId ?? statuses[0]?.id ?? "",
      priority: task?.priority ?? "medium",
      startDate: task?.startDate ?? null,
      endDate: task?.endDate ?? null,
    }
  }, [task, statuses])

  return {
    task,
    statuses,
    priorityOptions,
    defaultValues,
    saveTask,
    isSaving,
    assigneeOptions,
    assigneeUserId,
    setAssigneeUserId,
    attachments,
    setAttachments,
  }
}
