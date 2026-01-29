import { useCallback, useEffect, useState } from "react"

import { getTaskById, listCommentsByTask, listTaskEventsByTask, markTaskDeleted } from "@/services/db"
import type { Comment, Task, TaskEvent } from "@/services/db/types"
import { refreshLocalCounts } from "@/services/sync/syncStore"

export const useTaskDetailViewModel = (taskId: string) => {
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [events, setEvents] = useState<TaskEvent[]>([])

  const load = useCallback(async () => {
    const [taskRow, commentRows, eventRows] = await Promise.all([
      getTaskById(taskId),
      listCommentsByTask(taskId),
      listTaskEventsByTask(taskId),
    ])
    setTask(taskRow)
    setComments(commentRows)
    setEvents(eventRows)
  }, [taskId])

  useEffect(() => {
    void load()
  }, [load])

  const deleteTask = useCallback(async () => {
    const now = new Date().toISOString()
    await markTaskDeleted(taskId, now)
    await refreshLocalCounts()
  }, [taskId])

  return { task, comments, events, deleteTask, refresh: load }
}
