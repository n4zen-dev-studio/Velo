import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryAll, queryFirst } from "@/services/db/queries"
import type { User } from "@/services/db/types"
import { enqueueOp } from "@/services/db/repositories/changeLogRepository"
import { PERSONAL_WORKSPACE_ID } from "@/services/db/repositories/workspacesRepository"

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
  const runner = async (txDb: SQLiteDatabase) => {
    const existing = await queryFirst<UserRow>(txDb, "SELECT * FROM users WHERE id = ?", [user.id])

    await execute(
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
        deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        displayName = excluded.displayName,
        username = excluded.username,
        email = excluded.email,
        avatarUrl = excluded.avatarUrl,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt,
        revision = excluded.revision,
        deletedAt = excluded.deletedAt`,
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
      ],
    )

    if (options.enqueue) {
      await enqueueOp(
        {
          entityType: "user",
          entityId: user.id,
          opType: "UPSERT",
          patch: user,
          baseRevision: existing?.revision ?? "",
          projectId: null,
          workspaceId: PERSONAL_WORKSPACE_ID,
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

export async function getUserById(userId: string) {
  const database = await getDb()
  return queryFirst<UserRow>(database, "SELECT * FROM users WHERE id = ?", [userId])
}

export async function listUsersByWorkspaceId(workspaceId: string) {
  const database = await getDb()
  return queryAll<UserRow>(
    database,
    `
    SELECT u.*
    FROM users u
    JOIN workspace_members wm ON wm.userId = u.id
    WHERE wm.workspaceId = ?
      AND wm.deletedAt IS NULL
      AND (u.deletedAt IS NULL OR u.deletedAt = '')
    ORDER BY u.displayName, u.username, u.email
    `,
    [workspaceId],
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
  const runner = async (txDb: SQLiteDatabase) => {
    const existing = await queryFirst<UserRow>(txDb, "SELECT * FROM users WHERE id = ?", [userId])
    if (!existing) return
    const nextRevision = `${existing.revision}-deleted-${Date.now()}`
    await execute(
      txDb,
      "UPDATE users SET deletedAt = ?, updatedAt = ?, revision = ? WHERE id = ?",
      [deletedAt, deletedAt, nextRevision, userId],
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
          workspaceId: PERSONAL_WORKSPACE_ID,
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

export async function getUserLabelById(userId: string) {
  const database = await getDb()
  const row = await queryFirst<UserRow>(
    database,
    "SELECT displayName, username, email FROM users WHERE id = ? LIMIT 1",
    [userId],
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
