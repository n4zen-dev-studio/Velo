import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, queryAll, queryFirst } from "@/services/db/queries"
import type { Priority, Task } from "@/services/db/types"
import { decryptText, encryptText } from "@/utils/crypto"

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
  const encryptedDescription = await encryptText(task.description)

  await execute(
    database,
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
  await execute(database, "UPDATE tasks SET deletedAt = ? WHERE id = ?", [deletedAt, taskId])
}

async function mapTaskRow(row: TaskRow): Promise<Task> {
  return {
    ...row,
    description: await decryptText(row.description),
  }
}
