import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryAll, queryFirst } from "@/services/db/queries"
import type { Workspace } from "@/services/db/types"
import { seedDefaultStatusesForWorkspace, ensureDefaultStatusesForWorkspace } from "@/services/db/repositories/statusesRepository"
import { generateUuidV4 } from "@/services/sync/identity"

export const PERSONAL_WORKSPACE_ID = "personal"
export const PERSONAL_WORKSPACE_LABEL = "Personal"
const WORKSPACE_STATE_ID = "singleton"

export async function listWorkspaces(db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  return queryAll<Workspace>(
    database,
    "SELECT * FROM workspaces ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, createdAt ASC",
    [PERSONAL_WORKSPACE_ID],
  )
}

export async function getWorkspace(id: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  return queryFirst<Workspace>(database, "SELECT * FROM workspaces WHERE id = ?", [id])
}

export async function createWorkspace(label: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const now = Date.now()
  const workspace: Workspace = {
    id: await generateUuidV4(),
    label,
    kind: "custom",
    createdAt: now,
    updatedAt: now,
    remoteId: null,
  }

  await execute(
    database,
    `INSERT INTO workspaces (id, label, kind, createdAt, updatedAt, remoteId)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workspace.id, workspace.label, workspace.kind, workspace.createdAt, workspace.updatedAt, workspace.remoteId],
  )

  await seedDefaultStatusesForWorkspace(workspace.id, database)
  return workspace
}

export async function renameWorkspace(id: string, label: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const now = Date.now()
  await execute(
    database,
    "UPDATE workspaces SET label = ?, updatedAt = ? WHERE id = ?",
    [label, now, id],
  )
}

export async function deleteWorkspace(id: string, db?: SQLiteDatabase) {
  if (id === PERSONAL_WORKSPACE_ID) {
    throw new Error("Cannot delete Personal workspace")
  }
  const database = db ?? (await getDb())
  await execute(database, "DELETE FROM workspaces WHERE id = ?", [id])
}

export async function getActiveWorkspaceId(db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const row = await queryFirst<{ activeWorkspaceId: string }>(
    database,
    "SELECT activeWorkspaceId FROM workspace_state WHERE id = ?",
    [WORKSPACE_STATE_ID],
  )
  return row?.activeWorkspaceId ?? null
}

export async function setActiveWorkspaceId(id: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  await execute(
    database,
    `INSERT INTO workspace_state (id, activeWorkspaceId)
     VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET activeWorkspaceId = excluded.activeWorkspaceId`,
    [WORKSPACE_STATE_ID, id],
  )
}

export async function ensurePersonalWorkspaceExists(db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const existing = await getWorkspace(PERSONAL_WORKSPACE_ID, database)
  if (existing) return existing
  const now = Date.now()
  const workspace: Workspace = {
    id: PERSONAL_WORKSPACE_ID,
    label: PERSONAL_WORKSPACE_LABEL,
    kind: "personal",
    createdAt: now,
    updatedAt: now,
    remoteId: null,
  }
  await execute(
    database,
    `INSERT INTO workspaces (id, label, kind, createdAt, updatedAt, remoteId)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workspace.id, workspace.label, workspace.kind, workspace.createdAt, workspace.updatedAt, workspace.remoteId],
  )
  await ensureDefaultStatusesForWorkspace(workspace.id, database)
  return workspace
}

export async function ensureActiveWorkspaceIdValid(db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const current = await getActiveWorkspaceId(database)
  if (!current) {
    await setActiveWorkspaceId(PERSONAL_WORKSPACE_ID, database)
    return PERSONAL_WORKSPACE_ID
  }
  const existing = await getWorkspace(current, database)
  if (!existing) {
    await setActiveWorkspaceId(PERSONAL_WORKSPACE_ID, database)
    return PERSONAL_WORKSPACE_ID
  }
  return current
}

export async function bootstrapWorkspaces(db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  await executeTransaction(database, async (txDb) => {
    await ensurePersonalWorkspaceExists(txDb)
    await ensureActiveWorkspaceIdValid(txDb)
    await ensureDefaultStatusesForWorkspace(PERSONAL_WORKSPACE_ID, txDb)
  })
}
