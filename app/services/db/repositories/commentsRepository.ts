import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryAll, queryFirst } from "@/services/db/queries"
import type { Comment } from "@/services/db/types"
import { decryptText, encryptText } from "@/utils/crypto"
import { enqueueOp } from "@/services/db/repositories/changeLogRepository"
import { personalWorkspaceId } from "@/services/db/repositories/workspacesRepository"
import { getActiveScopeKey } from "@/services/session/scope"

interface CommentRow {
  id: string
  taskId: string
  body: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
  revision: string
  deletedAt: string | null
  scopeKey: string
}

export async function upsertComment(comment: Comment) {
  return upsertCommentInternal(comment, { enqueue: true, useTransaction: true }, undefined)
}

export async function upsertCommentFromSync(comment: Comment) {
  return upsertCommentInternal(comment, { enqueue: false, useTransaction: false }, undefined)
}

async function upsertCommentInternal(
  comment: Comment,
  options: { enqueue: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const runner = async (txDb: SQLiteDatabase) => {
    const scopeKey = comment.scopeKey ?? (await getActiveScopeKey())
    const existing = await queryFirst<CommentRow>(
      txDb,
      "SELECT * FROM comments WHERE id = ? AND scopeKey = ?",
      [comment.id, scopeKey],
    )
    const taskRow = await queryFirst<{ workspaceId: string }>(
      txDb,
      "SELECT workspaceId FROM tasks WHERE id = ? AND scopeKey = ?",
      [comment.taskId, scopeKey],
    )
    const workspaceId = taskRow?.workspaceId ?? personalWorkspaceId(scopeKey)
    const encryptedBody = await encryptText(comment.body)

    await execute(
      txDb,
      `INSERT INTO comments (
          id,
          taskId,
          body,
          createdByUserId,
          createdAt,
          updatedAt,
          revision,
          deletedAt,
          scopeKey
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          taskId = excluded.taskId,
          body = excluded.body,
          createdByUserId = excluded.createdByUserId,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt,
          revision = excluded.revision,
          deletedAt = excluded.deletedAt,
          scopeKey = excluded.scopeKey`,
      [
        comment.id,
        comment.taskId,
        encryptedBody,
        comment.createdByUserId,
        comment.createdAt,
        comment.updatedAt,
        comment.revision,
        comment.deletedAt,
        scopeKey,
      ],
    )

    if (options.enqueue) {
      await enqueueOp(
        {
          entityType: "comment",
          entityId: comment.id,
          opType: "UPSERT",
          // Patch is plaintext for sync; DB retains encrypted body.
          patch: {
            id: comment.id,
            taskId: comment.taskId,
            body: comment.body,
            createdByUserId: comment.createdByUserId,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            revision: comment.revision,
            deletedAt: comment.deletedAt,
          },
          baseRevision: existing?.revision ?? "",
          projectId: null,
          workspaceId,
          scopeKey,
          createdAt: new Date().toISOString(),
        },
        txDb,
      )
    }
  }

  if (options.useTransaction) {
    await executeTransaction(database, runner)
  } else {
    await runner(database)
  }
}

export async function listComments(taskId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const rows = await queryAll<CommentRow>(
    database,
    "SELECT * FROM comments WHERE scopeKey = ? AND taskId = ? AND deletedAt IS NULL ORDER BY createdAt ASC",
    [resolvedScope, taskId],
  )
  return Promise.all(rows.map(mapCommentRow))
}

export async function listCommentsByTask(taskId: string) {
  return listComments(taskId)
}

export async function listCommentsByTaskId(taskId: string) {
  return listComments(taskId)
}

export async function insertComment(comment: Comment) {
  await upsertComment(comment)
  return comment
}

export async function getCommentById(commentId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const row = await queryFirst<CommentRow>(
    database,
    "SELECT * FROM comments WHERE id = ? AND scopeKey = ?",
    [commentId, resolvedScope],
  )
  if (!row) return null
  return mapCommentRow(row)
}

export async function markCommentDeleted(commentId: string, deletedAt: string) {
  return markCommentDeletedInternal(commentId, deletedAt, { enqueue: true, useTransaction: true }, undefined)
}

export async function markCommentDeletedFromSync(
  commentId: string,
  deletedAt: string,
  db?: SQLiteDatabase,
) {
  return markCommentDeletedInternal(commentId, deletedAt, { enqueue: false, useTransaction: false }, db)
}

async function markCommentDeletedInternal(
  commentId: string,
  deletedAt: string,
  options: { enqueue: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const resolvedScope = await getActiveScopeKey()
  const runner = async (txDb: SQLiteDatabase) => {
    const existing = await queryFirst<CommentRow>(
      txDb,
      "SELECT * FROM comments WHERE id = ? AND scopeKey = ?",
      [commentId, resolvedScope],
    )
    if (!existing) return
    const taskRow = await queryFirst<{ workspaceId: string }>(
      txDb,
      "SELECT workspaceId FROM tasks WHERE id = ? AND scopeKey = ?",
      [existing.taskId, resolvedScope],
    )
    const workspaceId = taskRow?.workspaceId ?? personalWorkspaceId(existing.scopeKey)

    const nextRevision = `${existing.revision}-deleted-${Date.now()}`
    await execute(
      txDb,
      "UPDATE comments SET deletedAt = ?, updatedAt = ?, revision = ? WHERE id = ? AND scopeKey = ?",
      [deletedAt, deletedAt, nextRevision, commentId, resolvedScope],
    )

    if (options.enqueue) {
      const plaintextBody = await decryptText(existing.body)
      await enqueueOp(
        {
          entityType: "comment",
          entityId: commentId,
          opType: "DELETE",
          patch: {
            id: existing.id,
            taskId: existing.taskId,
            body: plaintextBody,
            createdByUserId: existing.createdByUserId,
            createdAt: existing.createdAt,
            updatedAt: deletedAt,
            revision: nextRevision,
            deletedAt,
          },
          baseRevision: existing.revision ?? "",
          projectId: null,
          workspaceId,
          scopeKey: existing.scopeKey,
          createdAt: new Date().toISOString(),
        },
        txDb,
      )
    }
  }

  if (options.useTransaction) {
    await executeTransaction(database, runner)
  } else {
    await runner(database)
  }
}

async function mapCommentRow(row: CommentRow): Promise<Comment> {
  return {
    ...row,
    body: await decryptText(row.body),
  }
}
