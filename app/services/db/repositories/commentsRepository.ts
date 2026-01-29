import { getDb } from "@/services/db/db"
import { execute, queryAll } from "@/services/db/queries"
import type { Comment } from "@/services/db/types"
import { decryptText, encryptText } from "@/utils/crypto"

interface CommentRow {
  id: string
  taskId: string
  body: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
  revision: string
  deletedAt: string | null
}

export async function upsertComment(comment: Comment) {
  const database = await getDb()
  const encryptedBody = await encryptText(comment.body)

  await execute(
    database,
    `INSERT INTO comments (
        id,
        taskId,
        body,
        createdByUserId,
        createdAt,
        updatedAt,
        revision,
        deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        taskId = excluded.taskId,
        body = excluded.body,
        createdByUserId = excluded.createdByUserId,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt,
        revision = excluded.revision,
        deletedAt = excluded.deletedAt`,
    [
      comment.id,
      comment.taskId,
      encryptedBody,
      comment.createdByUserId,
      comment.createdAt,
      comment.updatedAt,
      comment.revision,
      comment.deletedAt,
    ],
  )
}

export async function listComments(taskId: string) {
  const database = await getDb()
  const rows = await queryAll<CommentRow>(
    database,
    "SELECT * FROM comments WHERE taskId = ? AND deletedAt IS NULL ORDER BY createdAt ASC",
    [taskId],
  )
  return Promise.all(rows.map(mapCommentRow))
}

async function mapCommentRow(row: CommentRow): Promise<Comment> {
  return {
    ...row,
    body: await decryptText(row.body),
  }
}
