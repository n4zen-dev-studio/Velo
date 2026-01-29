import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryAll, queryFirst } from "@/services/db/queries"
import type { Priority, Task } from "@/services/db/types"
import { decryptText, encryptText } from "@/utils/crypto"
import { enqueueOp } from "@/services/db/repositories/changeLogRepository"
import { generateUuidV4, getCurrentUserId } from "@/services/sync/identity"

interface TaskRow {
  id: string
  projectId: string | null
  title: string
  description: string
  statusId: string
  priority: Priority
  assigneeUserId: string | null
  createdByUserId: string
  updatedAt: string
  revision: string
  deletedAt: string | null
}

export async function upsertTask(task: Task, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  await executeTransaction(database, async (txDb) => {
    const existing = await queryFirst<TaskRow>(txDb, "SELECT * FROM tasks WHERE id = ?", [
      task.id,
    ])
    const encryptedDescription = await encryptText(task.description)

    await execute(
      txDb,
      `INSERT INTO tasks (
          id,
          projectId,
          title,
          description,
          statusId,
          priority,
          assigneeUserId,
          createdByUserId,
          updatedAt,
          revision,
          deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          projectId = excluded.projectId,
          title = excluded.title,
          description = excluded.description,
          statusId = excluded.statusId,
          priority = excluded.priority,
          assigneeUserId = excluded.assigneeUserId,
          createdByUserId = excluded.createdByUserId,
          updatedAt = excluded.updatedAt,
          revision = excluded.revision,
          deletedAt = excluded.deletedAt`,
      [
        task.id,
        task.projectId,
        task.title,
        encryptedDescription,
        task.statusId,
        task.priority,
        task.assigneeUserId,
        task.createdByUserId,
        task.updatedAt,
        task.revision,
        task.deletedAt,
      ],
    )

    // baseRevision must reflect the revision before this local mutation.
    const baseRevision = existing?.revision ?? ""
    await enqueueOp(
      {
        entityType: "task",
        entityId: task.id,
        opType: "UPSERT",
        // Patch is plaintext for sync; DB retains encrypted description.
        patch: {
          id: task.id,
          projectId: task.projectId,
          title: task.title,
          description: task.description,
          statusId: task.statusId,
          priority: task.priority,
          assigneeUserId: task.assigneeUserId,
          updatedAt: task.updatedAt,
          revision: task.revision,
          deletedAt: task.deletedAt,
        },
        baseRevision,
        projectId: task.projectId ?? null,
        createdAt: new Date().toISOString(),
      },
      txDb,
    )

    if (existing && existing.statusId !== task.statusId) {
      const userId = await getCurrentUserId()
      const eventPayload = JSON.stringify({
        from: existing.statusId,
        to: task.statusId,
        revision: task.revision,
      })
      await execute(
        txDb,
        `INSERT INTO task_events (id, taskId, type, payload, createdAt, createdByUserId)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [await generateUuidV4(), task.id, "STATUS_CHANGED", eventPayload, task.updatedAt, userId],
      )
    }
  })
}

export async function listTasksByWorkspace(projectId: string | null) {
  const database = await getDb()
  const sql = projectId
    ? "SELECT * FROM tasks WHERE projectId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC"
    : "SELECT * FROM tasks WHERE projectId IS NULL AND deletedAt IS NULL ORDER BY updatedAt DESC"
  const rows = await queryAll<TaskRow>(database, sql, projectId ? [projectId] : [])
  return Promise.all(rows.map(mapTaskRow))
}

export async function getTaskById(taskId: string) {
  const database = await getDb()
  const row = await queryFirst<TaskRow>(database, "SELECT * FROM tasks WHERE id = ?", [taskId])
  if (!row) return null
  return mapTaskRow(row)
}

export async function markTaskDeleted(taskId: string, deletedAt: string) {
  const database = await getDb()
  await executeTransaction(database, async (txDb) => {
    const existing = await queryFirst<TaskRow>(txDb, "SELECT * FROM tasks WHERE id = ?", [taskId])
    if (!existing) return

    const nextRevision = `${existing.revision}-deleted-${Date.now()}`
    await execute(
      txDb,
      "UPDATE tasks SET deletedAt = ?, updatedAt = ?, revision = ? WHERE id = ?",
      [deletedAt, deletedAt, nextRevision, taskId],
    )

    const plaintextDescription = await decryptText(existing.description)
    await enqueueOp(
      {
        entityType: "task",
        entityId: taskId,
        opType: "DELETE",
        patch: {
          id: taskId,
          projectId: existing.projectId,
          title: existing.title,
          description: plaintextDescription,
          statusId: existing.statusId,
          priority: existing.priority,
          assigneeUserId: existing.assigneeUserId,
          updatedAt: deletedAt,
          revision: nextRevision,
          deletedAt,
        },
        baseRevision: existing.revision ?? "",
        projectId: existing.projectId ?? null,
        createdAt: new Date().toISOString(),
      },
      txDb,
    )
  })
}

async function mapTaskRow(row: TaskRow): Promise<Task> {
  return {
    ...row,
    description: await decryptText(row.description),
  }
}
