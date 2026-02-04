import { useCallback, useEffect, useMemo, useState } from "react"
import { useFocusEffect } from "@react-navigation/native"

import {
  getTaskById,
  insertComment,
  listCommentsByTaskId,
  listTaskEventsByTask,
  markTaskDeleted,
} from "@/services/db"
import type { Comment, Task, TaskEvent } from "@/services/db/types"
import { refreshLocalCounts } from "@/services/sync/syncStore"
import { generateUuidV4, getCurrentUserId } from "@/services/sync/identity"

export const useTaskDetailViewModel = (taskId: string) => {
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [isSavingComment, setIsSavingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [taskRow, commentRows, eventRows] = await Promise.all([
      getTaskById(taskId),
      listCommentsByTaskId(taskId),
      listTaskEventsByTask(taskId),
    ])
    setTask(taskRow)
    setComments(commentRows)
    setEvents(eventRows)
  }, [taskId])

  useEffect(() => {
    void load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const addComment = useCallback(
    async (body: string) => {
      const trimmed = body.trim()
      if (!trimmed.length) return null
      setIsSavingComment(true)
      setCommentError(null)
      const now = new Date().toISOString()
      const currentUserId = await getCurrentUserId()
      const optimistic: Comment = {
        id: await generateUuidV4(),
        taskId,
        body: trimmed,
        createdByUserId: currentUserId,
        createdAt: now,
        updatedAt: now,
        revision: `rev-${Date.now()}`,
        deletedAt: null,
      }

      setComments((prev) => [...prev, optimistic])
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
    deleteTask,
    refresh: load,
    addComment,
    isSavingComment,
    commentError,
  }
}
