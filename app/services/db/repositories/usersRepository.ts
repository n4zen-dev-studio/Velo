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
import type { User } from "@/services/db/types"
import { enqueueOp } from "@/services/db/repositories/changeLogRepository"
import { personalWorkspaceId } from "@/services/db/repositories/workspacesRepository"
import { getActiveScopeKey } from "@/services/session/scope"

interface UserRow {
  id: string
  displayName: string | null
  username: string | null
  email: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  revision: string
  deletedAt: string | null
  scopeKey: string
}

export async function upsertUser(user: User, db?: SQLiteDatabase) {
  return upsertUserInternal(user, { enqueue: true, useTransaction: true }, db)
}

export async function upsertUserFromSync(user: User, db?: SQLiteDatabase) {
  return upsertUserInternal(user, { enqueue: false, useTransaction: false }, db)
}

async function upsertUserInternal(
  user: User,
  options: { enqueue: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const resolvedScope = user.scopeKey ?? (await getActiveScopeKey())
  const useTx = db !== undefined || options.useTransaction
  const runner = async (txDb: SQLiteDatabase, useTxRunner: boolean) => {
    const exec = useTxRunner ? executeTx : execute
    const queryFirstFn = useTxRunner ? queryFirstTx : queryFirst
    const existing = await queryFirstFn<UserRow>(
      txDb,
      "SELECT * FROM users WHERE id = ? AND scopeKey = ?",
      [user.id, resolvedScope],
    )

    await exec(
      txDb,
      `INSERT INTO users (
        id,
        displayName,
        username,
        email,
        avatarUrl,
        createdAt,
        updatedAt,
        revision,
        deletedAt,
        scopeKey
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        displayName = excluded.displayName,
        username = excluded.username,
        email = excluded.email,
        avatarUrl = excluded.avatarUrl,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt,
        revision = excluded.revision,
        deletedAt = excluded.deletedAt,
        scopeKey = excluded.scopeKey`,
      [
        user.id,
        user.displayName,
        user.username,
        user.email,
        user.avatarUrl,
        user.createdAt,
        user.updatedAt,
        user.revision,
        user.deletedAt,
        resolvedScope,
      ],
    )

    if (options.enqueue) {
      await enqueueOp(
        {
          entityType: "user",
          entityId: user.id,
          opType: "UPSERT",
          patch: { ...user, scopeKey: resolvedScope },
          baseRevision: existing?.revision ?? "",
          projectId: null,
          workspaceId: personalWorkspaceId(resolvedScope),
          scopeKey: resolvedScope,
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

export async function getUserById(userId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryFirst<UserRow>(
    database,
    "SELECT * FROM users WHERE id = ? AND scopeKey = ?",
    [userId, resolvedScope],
  )
}

export async function listUsersByWorkspaceId(workspaceId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryAll<UserRow>(
    database,
    `
    SELECT u.*
    FROM users u
    JOIN workspace_members wm ON wm.userId = u.id
    WHERE wm.workspaceId = ?
      AND wm.scopeKey = ?
      AND u.scopeKey = ?
      AND wm.deletedAt IS NULL
      AND (u.deletedAt IS NULL OR u.deletedAt = '')
    ORDER BY u.displayName, u.username, u.email
    `,
    [workspaceId, resolvedScope, resolvedScope],
  )
}

export async function listByWorkspaceId(workspaceId: string) {
  return listUsersByWorkspaceId(workspaceId)
}

export async function markUserDeleted(userId: string, deletedAt: string) {
  return markUserDeletedInternal(userId, deletedAt, { enqueue: true, useTransaction: true }, undefined)
}

export async function markUserDeletedFromSync(
  userId: string,
  deletedAt: string,
  db?: SQLiteDatabase,
) {
  return markUserDeletedInternal(userId, deletedAt, { enqueue: false, useTransaction: false }, db)
}

async function markUserDeletedInternal(
  userId: string,
  deletedAt: string,
  options: { enqueue: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const useTx = db !== undefined || options.useTransaction
  const resolvedScope = await getActiveScopeKey()
  const runner = async (txDb: SQLiteDatabase, useTxRunner: boolean) => {
    const exec = useTxRunner ? executeTx : execute
    const queryFirstFn = useTxRunner ? queryFirstTx : queryFirst
    const existing = await queryFirstFn<UserRow>(
      txDb,
      "SELECT * FROM users WHERE id = ? AND scopeKey = ?",
      [userId, resolvedScope],
    )
    if (!existing) return
    const nextRevision = `${existing.revision}-deleted-${Date.now()}`
    await exec(
      txDb,
      "UPDATE users SET deletedAt = ?, updatedAt = ?, revision = ? WHERE id = ? AND scopeKey = ?",
      [deletedAt, deletedAt, nextRevision, userId, resolvedScope],
    )

    if (options.enqueue) {
      await enqueueOp(
        {
          entityType: "user",
          entityId: userId,
          opType: "DELETE",
          patch: {
            ...existing,
            updatedAt: deletedAt,
            revision: nextRevision,
            deletedAt,
          },
          baseRevision: existing.revision ?? "",
          projectId: null,
          workspaceId: personalWorkspaceId(resolvedScope),
          scopeKey: resolvedScope,
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

export async function getUserLabelById(userId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const row = await queryFirst<UserRow>(
    database,
    "SELECT displayName, username, email FROM users WHERE id = ? AND scopeKey = ? LIMIT 1",
    [userId, resolvedScope],
  )
  if (!row) return null
  const displayName = row.displayName?.trim()
  if (displayName) return displayName
  const username = row.username?.trim()
  if (username) return username
  const email = row.email?.trim()
  if (email) return email
  return null
}
