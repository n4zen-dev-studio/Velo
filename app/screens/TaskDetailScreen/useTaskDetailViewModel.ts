import { useCallback, useEffect, useMemo, useState } from "react"

import {
  getTaskById,
  insertComment,
  listCommentsByTaskId,
  listTaskEventsByTask,
  listStatuses,
  markTaskDeleted,
} from "@/services/db"
import type { Comment, Task, TaskEvent } from "@/services/db/types"
import { resolveAuthorLabel } from "@/services/users/resolveAuthorLabel"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { generateUuidV4, getCurrentUserId, getSessionMode } from "@/services/sync/identity"
import { ANON_USER_ID } from "@/services/constants/identity"
import { resolveScopeKeyForTaskId } from "@/services/db/scopeKey"

export type CommentVM = Comment & { authorLabel: string }
export type TaskEventVM = TaskEvent & { authorLabel: string }

export const useTaskDetailViewModel = (taskId: string) => {
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<CommentVM[]>([])
  const [events, setEvents] = useState<TaskEventVM[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})
  const [isSavingComment, setIsSavingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const loadComments = useCallback(async () => {
    const commentRows = await listCommentsByTaskId(taskId)
    const currentUserId = await getCurrentUserId()
    const withAuthors = await Promise.all(
      commentRows.map(async (comment) => ({
        ...comment,
        authorLabel: await resolveAuthorLabel({
          createdByUserId: comment.createdByUserId,
          currentUserId,
        }),
      })),
    )
    setComments(withAuthors)
  }, [taskId])

  const load = useCallback(async () => {
    const taskRow = await getTaskById(taskId)
    setTask(taskRow)

    const [eventRows, statuses] = await Promise.all([
      listTaskEventsByTask(taskId),
      taskRow ? listStatuses(taskRow.workspaceId, taskRow.projectId ?? null) : Promise.resolve([]),
    ])

    const nextMap: Record<string, string> = {}
    statuses.forEach((status) => {
      nextMap[status.id] = status.name
    })
    setStatusMap(nextMap)

    const currentUserId = await getCurrentUserId()
    const withAuthors = await Promise.all(
      eventRows.map(async (event) => ({
        ...event,
        authorLabel: await resolveAuthorLabel({
          createdByUserId: event.createdByUserId,
          currentUserId,
        }),
      })),
    )
    setEvents(withAuthors)

    await loadComments()
  }, [taskId, loadComments])

  useEffect(() => {
    void load()
  }, [load])

  const addComment = useCallback(
    async (body: string) => {
      const trimmed = body.trim()
      if (!trimmed.length) return null
      setIsSavingComment(true)
      setCommentError(null)
      const now = new Date().toISOString()
      const sessionMode = await getSessionMode()
      const currentUserId = sessionMode === "remote" ? await getCurrentUserId() : null
      const createdByUserId = currentUserId ?? ANON_USER_ID
      const scopeKey = await resolveScopeKeyForTaskId(taskId)
      const authorLabel = await resolveAuthorLabel({
        createdByUserId,
        currentUserId,
      })
      const optimistic: Comment = {
        id: await generateUuidV4(),
        taskId,
        body: trimmed,
        createdByUserId,
        createdAt: now,
        updatedAt: now,
        revision: `rev-${Date.now()}`,
        deletedAt: null,
        scopeKey,
      }

      setComments((prev) => [...prev, { ...optimistic, authorLabel }])
      try {
        await insertComment(optimistic)
        await refreshLocalCounts()
        return optimistic
      } catch (error) {
        setComments((prev) => prev.filter((comment) => comment.id !== optimistic.id))
        const message = error instanceof Error ? error.message : "Failed to add comment"
        setCommentError(message)
        return null
      } finally {
        setIsSavingComment(false)
      }
    },
    [taskId],
  )

  const commentsByCreatedAt = useMemo(() => {
    return [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [comments])

  const deleteTask = useCallback(async () => {
    const now = new Date().toISOString()
    await markTaskDeleted(taskId, now)
    await refreshLocalCounts()
  }, [taskId])

  return {
    task,
    comments: commentsByCreatedAt,
    events,
    statusMap,
    deleteTask,
    refresh: load,
    addComment,
    isSavingComment,
    commentError,
  }
}
