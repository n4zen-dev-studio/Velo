import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, executeTransaction, executeTx, queryAll } from "@/services/db/queries"
import { resolveScopeKeyForTaskId, resolveWorkspaceScopeKey } from "@/services/db/scopeKey"
import type { TaskAttachment } from "@/services/db/types"

interface TaskAttachmentRow {
  id: string
  taskId: string
  workspaceId: string
  fileName: string
  mimeType: string
  localUri: string
  remoteUri: string | null
  fileSize: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  scopeKey: string
}

export async function listTaskAttachments(taskId: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const scopeKey = await resolveScopeKeyForTaskId(taskId, undefined, database)
  return queryAll<TaskAttachmentRow>(
    database,
    `SELECT * FROM task_attachments
     WHERE taskId = ? AND scopeKey = ? AND deletedAt IS NULL
     ORDER BY createdAt ASC`,
    [taskId, scopeKey],
  )
}

export async function replaceTaskAttachments(
  taskId: string,
  workspaceId: string,
  attachments: TaskAttachment[],
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const runner = async (txDb: SQLiteDatabase) => {
    const scopeKey =
      attachments[0]?.scopeKey ?? (await resolveWorkspaceScopeKey(workspaceId, undefined, txDb))

    await executeTx(
      txDb,
      "UPDATE task_attachments SET deletedAt = ?, updatedAt = ? WHERE taskId = ? AND scopeKey = ?",
      [new Date().toISOString(), new Date().toISOString(), taskId, scopeKey],
    )

    for (const attachment of attachments) {
      await upsertTaskAttachment(
        {
          ...attachment,
          taskId,
          workspaceId,
          scopeKey,
          deletedAt: null,
        },
        txDb,
      )
    }
  }

  if (db) {
    await runner(database)
    return
  }

  await executeTransaction(database, runner)
}

export async function upsertTaskAttachment(attachment: TaskAttachment, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const exec = db ? executeTx : execute
  await exec(
    database,
    `INSERT INTO task_attachments (
      id,
      taskId,
      workspaceId,
      fileName,
      mimeType,
      localUri,
      remoteUri,
      fileSize,
      createdAt,
      updatedAt,
      deletedAt,
      scopeKey
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      taskId = excluded.taskId,
      workspaceId = excluded.workspaceId,
      fileName = excluded.fileName,
      mimeType = excluded.mimeType,
      localUri = excluded.localUri,
      remoteUri = excluded.remoteUri,
      fileSize = excluded.fileSize,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      deletedAt = excluded.deletedAt,
      scopeKey = excluded.scopeKey`,
    [
      attachment.id,
      attachment.taskId,
      attachment.workspaceId,
      attachment.fileName,
      attachment.mimeType,
      attachment.localUri,
      attachment.remoteUri,
      attachment.fileSize,
      attachment.createdAt,
      attachment.updatedAt,
      attachment.deletedAt,
      attachment.scopeKey,
    ],
  )
}
