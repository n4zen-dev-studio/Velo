import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryAll, queryFirst } from "@/services/db/queries"
import type { WorkspaceMember } from "@/services/db/types"
import { enqueueOp } from "@/services/db/repositories/changeLogRepository"
import { getActiveScopeKey } from "@/services/session/scope"

interface WorkspaceMemberRow {
  id: string
  workspaceId: string
  userId: string
  role: string
  createdAt: string
  updatedAt: string
  revision: string
  deletedAt: string | null
  scopeKey: string
}

export async function upsertWorkspaceMember(member: WorkspaceMember, db?: SQLiteDatabase) {
  return upsertWorkspaceMemberInternal(member, { enqueue: true, useTransaction: true }, db)
}

export async function upsertWorkspaceMemberFromSync(
  member: WorkspaceMember,
  db?: SQLiteDatabase,
) {
  return upsertWorkspaceMemberInternal(member, { enqueue: false, useTransaction: false }, db)
}

async function upsertWorkspaceMemberInternal(
  member: WorkspaceMember,
  options: { enqueue: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const resolvedScope = member.scopeKey ?? (await getActiveScopeKey())
  const runner = async (txDb: SQLiteDatabase) => {
    const existing = await queryFirst<WorkspaceMemberRow>(
      txDb,
      "SELECT * FROM workspace_members WHERE id = ? AND scopeKey = ?",
      [member.id, resolvedScope],
    )

    await execute(
      txDb,
      `INSERT INTO workspace_members (
        id,
        workspaceId,
        userId,
        role,
        createdAt,
        updatedAt,
        revision,
        deletedAt,
        scopeKey
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workspaceId = excluded.workspaceId,
        userId = excluded.userId,
        role = excluded.role,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt,
        revision = excluded.revision,
        deletedAt = excluded.deletedAt,
        scopeKey = excluded.scopeKey`,
      [
        member.id,
        member.workspaceId,
        member.userId,
        member.role,
        member.createdAt,
        member.updatedAt,
        member.revision,
        member.deletedAt,
        resolvedScope,
      ],
    )

    if (options.enqueue) {
      await enqueueOp(
        {
          entityType: "workspace_member",
          entityId: member.id,
          opType: "UPSERT",
          patch: { ...member, scopeKey: resolvedScope },
          baseRevision: existing?.revision ?? "",
          projectId: null,
          workspaceId: member.workspaceId,
          scopeKey: resolvedScope,
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

export async function getWorkspaceMemberById(id: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryFirst<WorkspaceMemberRow>(
    database,
    "SELECT * FROM workspace_members WHERE id = ? AND scopeKey = ?",
    [id, resolvedScope],
  )
}

export async function listWorkspaceMembersByWorkspaceId(workspaceId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryAll<WorkspaceMemberRow>(
    database,
    "SELECT * FROM workspace_members WHERE scopeKey = ? AND workspaceId = ? AND deletedAt IS NULL ORDER BY createdAt ASC",
    [resolvedScope, workspaceId],
  )
}

export async function listByWorkspaceId(workspaceId: string) {
  return listWorkspaceMembersByWorkspaceId(workspaceId)
}

export async function markWorkspaceMemberDeleted(memberId: string, deletedAt: string) {
  return markWorkspaceMemberDeletedInternal(
    memberId,
    deletedAt,
    { enqueue: true, useTransaction: true },
    undefined,
  )
}

export async function markWorkspaceMemberDeletedFromSync(
  memberId: string,
  deletedAt: string,
  db?: SQLiteDatabase,
) {
  return markWorkspaceMemberDeletedInternal(
    memberId,
    deletedAt,
    { enqueue: false, useTransaction: false },
    db,
  )
}

async function markWorkspaceMemberDeletedInternal(
  memberId: string,
  deletedAt: string,
  options: { enqueue: boolean; useTransaction: boolean },
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const resolvedScope = await getActiveScopeKey()
  const runner = async (txDb: SQLiteDatabase) => {
    const existing = await queryFirst<WorkspaceMemberRow>(
      txDb,
      "SELECT * FROM workspace_members WHERE id = ? AND scopeKey = ?",
      [memberId, resolvedScope],
    )
    if (!existing) return
    const nextRevision = `${existing.revision}-deleted-${Date.now()}`
    await execute(
      txDb,
      "UPDATE workspace_members SET deletedAt = ?, updatedAt = ?, revision = ? WHERE id = ? AND scopeKey = ?",
      [deletedAt, deletedAt, nextRevision, memberId, resolvedScope],
    )

    if (options.enqueue) {
      await enqueueOp(
        {
          entityType: "workspace_member",
          entityId: memberId,
          opType: "DELETE",
          patch: {
            ...existing,
            updatedAt: deletedAt,
            revision: nextRevision,
            deletedAt,
          },
          baseRevision: existing.revision ?? "",
          projectId: null,
          workspaceId: existing.workspaceId,
          scopeKey: resolvedScope,
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
