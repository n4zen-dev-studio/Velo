import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import {
  execute,
  executeTransaction,
  executeTx,
  queryAll,
  queryFirst,
  queryFirstTx,
} from "@/services/db/queries"
import { enqueueOp } from "@/services/db/repositories/changeLogRepository"
import {
  listAllDataScopeKeys,
  resolveScopeKeyForTaskId,
  resolveWorkspaceScopeKey,
} from "@/services/db/scopeKey"
import type { Priority, Task } from "@/services/db/types"
import { generateUuidV4, getCurrentUserId } from "@/services/sync/identity"
import { decryptText, encryptText } from "@/utils/crypto"

interface TaskRow {
  id: string
  projectId: string | null
  workspaceId: string
  title: string
  description: string
  statusId: string
  priority: Priority
  assigneeUserId: string | null
  createdByUserId: string
  startDate: string | null
  endDate: string | null
  updatedAt: string
  revision: string
  deletedAt: string | null
  scopeKey: string
}

export async function upsertTask(task: Task, db?: SQLiteDatabase) {
  return upsertTaskInternal(task, { enqueue: true, createEvent: true, useTransaction: true }, db)
}

export async function upsertTaskFromSync(task: Task, db?: SQLiteDatabase) {
  return upsertTaskInternal(task, { enqueue: false, createEvent: false, useTransaction: false }, db)
}

export async function markTaskDeleted(taskId: string, deletedAt: string) {
  return markTaskDeletedInternal(
    taskId,
    deletedAt,
    { enqueue: true, useTransaction: true },
    undefined,
  )
}

export async function markTaskDeletedFromSync(
  taskId: string,
  deletedAt: string,
  db?: SQLiteDatabase,
) {
  return markTaskDeletedInternal(taskId, deletedAt, { enqueue: false, useTransaction: false }, db)
}

async function upsertTaskInternal(
  task: Task,
  options: { enqueue: boolean; createEvent: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const useTx = db !== undefined || options.useTransaction
  const runner = async (txDb: SQLiteDatabase, useTxRunner: boolean) => {
    const exec = useTxRunner ? executeTx : execute
    const queryFirstFn = useTxRunner ? queryFirstTx : queryFirst
    const scopeKey =
      task.scopeKey ?? (await resolveWorkspaceScopeKey(task.workspaceId, undefined, txDb))
    const existing = await queryFirstFn<TaskRow>(
      txDb,
      "SELECT * FROM tasks WHERE id = ? AND scopeKey = ?",
      [task.id, scopeKey],
    )
    const encryptedDescription = await encryptText(task.description)

    await exec(
      txDb,
      `INSERT INTO tasks (
          id,
          projectId,
          workspaceId,
          title,
          description,
          statusId,
          priority,
          assigneeUserId,
          createdByUserId,
          startDate,
          endDate,
          updatedAt,
          revision,
          deletedAt,
          scopeKey
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          projectId = excluded.projectId,
          workspaceId = excluded.workspaceId,
          title = excluded.title,
          description = excluded.description,
          statusId = excluded.statusId,
          priority = excluded.priority,
          assigneeUserId = excluded.assigneeUserId,
          createdByUserId = excluded.createdByUserId,
          startDate = excluded.startDate,
          endDate = excluded.endDate,
          updatedAt = excluded.updatedAt,
          revision = excluded.revision,
          deletedAt = excluded.deletedAt,
          scopeKey = excluded.scopeKey`,
      [
        task.id,
        task.projectId,
        task.workspaceId,
        task.title,
        encryptedDescription,
        task.statusId,
        task.priority,
        task.assigneeUserId,
        task.createdByUserId,
        task.startDate,
        task.endDate,
        task.updatedAt,
        task.revision,
        task.deletedAt,
        scopeKey,
      ],
    )

    // baseRevision must reflect the revision before this local mutation.
    if (options.enqueue) {
      const baseRevision = existing?.revision ?? ""
      const workspaceIdForSync = task.workspaceId.startsWith("personal:") ? null : task.workspaceId
      if (__DEV__) {
        console.log("[db] enqueue task", {
          taskId: task.id,
          workspaceId: workspaceIdForSync ?? "personal",
          projectId: task.projectId,
        })
      }
      await enqueueOp(
        {
          entityType: "task",
          entityId: task.id,
          opType: "UPSERT",
          // Patch is plaintext for sync; DB retains encrypted description.
          patch: {
            id: task.id,
            projectId: task.projectId,
            workspaceId: workspaceIdForSync,
            title: task.title,
            description: task.description,
            statusId: task.statusId,
            priority: task.priority,
            assigneeUserId: task.assigneeUserId,
            startDate: task.startDate,
            endDate: task.endDate,
            updatedAt: task.updatedAt,
            revision: task.revision,
            deletedAt: task.deletedAt,
          },
          baseRevision,
          projectId: task.projectId ?? null,
          workspaceId: task.workspaceId,
          scopeKey,
          createdAt: new Date().toISOString(),
        },
        useTxRunner ? txDb : undefined,
      )
    }

    if (options.createEvent && existing && existing.statusId !== task.statusId) {
      const userId = await getCurrentUserId()
      const eventPayload = JSON.stringify({
        from: existing.statusId,
        to: task.statusId,
        revision: task.revision,
      })
      await executeTx(
        txDb,
        `INSERT INTO task_events (id, taskId, type, payload, createdAt, createdByUserId, scopeKey)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          await generateUuidV4(),
          task.id,
          "STATUS_CHANGED",
          eventPayload,
          task.updatedAt,
          userId,
          scopeKey,
        ],
      )
    }
  }

  if (options.useTransaction) {
    await executeTransaction(database, (txDb) => runner(txDb, true))
  } else {
    await runner(database, useTx)
  }
}

export async function listTasksByWorkspace(
  workspaceId: string,
  projectId?: string | null,
  scopeKey?: string,
) {
  const database = await getDb()
  const resolvedScope = await resolveWorkspaceScopeKey(workspaceId, scopeKey, database)
  const isProjectScoped = projectId !== undefined
  const sql = isProjectScoped
    ? projectId
      ? "SELECT * FROM tasks WHERE scopeKey = ? AND workspaceId = ? AND projectId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC"
      : "SELECT * FROM tasks WHERE scopeKey = ? AND workspaceId = ? AND projectId IS NULL AND deletedAt IS NULL ORDER BY updatedAt DESC"
    : "SELECT * FROM tasks WHERE scopeKey = ? AND workspaceId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC"
  const params = isProjectScoped
    ? projectId
      ? [resolvedScope, workspaceId, projectId]
      : [resolvedScope, workspaceId]
    : [resolvedScope, workspaceId]
  const rows = await queryAll<TaskRow>(database, sql, params)
  return Promise.all(rows.map(mapTaskRow))
}

export async function getTaskById(taskId: string, scopeKey?: string) {
  const database = await getDb()
  const scopes = await listAllDataScopeKeys(scopeKey, database)
  const placeholders = scopes.map(() => "?").join(", ")
  const row = await queryFirst<TaskRow>(
    database,
    `SELECT * FROM tasks WHERE id = ? AND scopeKey IN (${placeholders})`,
    [taskId, ...scopes],
  )
  if (!row) return null
  return mapTaskRow(row)
}

async function markTaskDeletedInternal(
  taskId: string,
  deletedAt: string,
  options: { enqueue: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const useTx = db !== undefined || options.useTransaction
  const runner = async (txDb: SQLiteDatabase, useTxRunner: boolean) => {
    const exec = useTxRunner ? executeTx : execute
    const queryFirstFn = useTxRunner ? queryFirstTx : queryFirst
    const resolvedScope = await resolveScopeKeyForTaskId(taskId, undefined, txDb)
    const existing = await queryFirstFn<TaskRow>(
      txDb,
      "SELECT * FROM tasks WHERE id = ? AND scopeKey = ?",
      [taskId, resolvedScope],
    )
    if (!existing) return

    const nextRevision = `${existing.revision}-deleted-${Date.now()}`
    await exec(
      txDb,
      "UPDATE tasks SET deletedAt = ?, updatedAt = ?, revision = ? WHERE id = ? AND scopeKey = ?",
      [deletedAt, deletedAt, nextRevision, taskId, resolvedScope],
    )

    if (options.enqueue) {
      const plaintextDescription = await decryptText(existing.description)
      const workspaceIdForSync = existing.workspaceId.startsWith("personal:")
        ? null
        : existing.workspaceId
      await enqueueOp(
        {
          entityType: "task",
          entityId: taskId,
          opType: "DELETE",
          patch: {
            id: taskId,
            projectId: existing.projectId,
            workspaceId: workspaceIdForSync,
            title: existing.title,
            description: plaintextDescription,
            statusId: existing.statusId,
            priority: existing.priority,
            assigneeUserId: existing.assigneeUserId,
            startDate: existing.startDate,
            endDate: existing.endDate,
            updatedAt: deletedAt,
            revision: nextRevision,
            deletedAt,
          },
          baseRevision: existing.revision ?? "",
          projectId: existing.projectId ?? null,
          workspaceId: existing.workspaceId,
          scopeKey: existing.scopeKey,
          createdAt: new Date().toISOString(),
        },
        useTxRunner ? txDb : undefined,
      )
    }
  }

  if (options.useTransaction) {
    await executeTransaction(database, (txDb) => runner(txDb, true))
  } else {
    await runner(database, useTx)
  }
}

async function mapTaskRow(row: TaskRow): Promise<Task> {
  return {
    ...row,
    description: await decryptText(row.description),
  }
}
