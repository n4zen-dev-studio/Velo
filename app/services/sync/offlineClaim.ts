import { getDb } from "@/services/db/db"
import { queryFirst } from "@/services/db/queries"
import { listTasksByWorkspace, upsertTask } from "@/services/db/repositories/tasksRepository"
import { PERSONAL_WORKSPACE_ID } from "@/services/db/repositories/workspacesRepository"
import { listCommentsByTask, upsertComment } from "@/services/db/repositories/commentsRepository"
import type { Comment, Task } from "@/services/db/types"
import { getSessionMode } from "@/services/sync/identity"
import { loadString, saveString } from "@/utils/storage"

const OFFLINE_CLAIM_KEY = "tasktrak.offlineClaimed"
const SYNC_STATE_ID = "singleton"

export async function shouldPromptOfflineClaim() {
  const sessionMode = await getSessionMode()
  if (sessionMode !== "local") return false
  const claimed = loadString(OFFLINE_CLAIM_KEY)
  if (claimed === "true") return false

  const db = await getDb()
  const cursorRow = await queryFirst<{ lastCursor: string | null }>(
    db,
    "SELECT lastCursor FROM sync_state WHERE id = ?",
    [SYNC_STATE_ID],
  )
  if (cursorRow?.lastCursor) return false

  const row = await queryFirst<{ count: number }>(
    db,
    "SELECT COUNT(1) as count FROM tasks WHERE workspaceId = ? AND projectId IS NULL AND deletedAt IS NULL",
    [PERSONAL_WORKSPACE_ID],
  )

  return (row?.count ?? 0) > 0
}

export function markOfflineClaimHandled() {
  saveString(OFFLINE_CLAIM_KEY, "true")
}

export async function claimOfflineData(remoteUserId: string) {
  const tasks = await listTasksByWorkspace(PERSONAL_WORKSPACE_ID, null)
  if (tasks.length === 0) return

  const nowBase = Date.now()
  for (const task of tasks) {
    await claimTask(task, remoteUserId, nowBase)
    const comments = await listCommentsByTask(task.id)
    for (const comment of comments) {
      await claimComment(comment, remoteUserId, nowBase)
    }
  }
}

async function claimTask(task: Task, remoteUserId: string, nowBase: number) {
  const updatedAt = new Date(nowBase).toISOString()
  const nextRevision = `${task.revision}-claim-${nowBase}`
  await upsertTask({
    ...task,
    createdByUserId: remoteUserId,
    assigneeUserId: remoteUserId,
    updatedAt,
    revision: nextRevision,
  })
}

async function claimComment(comment: Comment, remoteUserId: string, nowBase: number) {
  const updatedAt = new Date(nowBase).toISOString()
  const nextRevision = `${comment.revision}-claim-${nowBase}`
  await upsertComment({
    ...comment,
    createdByUserId: remoteUserId,
    updatedAt,
    revision: nextRevision,
  })
}
