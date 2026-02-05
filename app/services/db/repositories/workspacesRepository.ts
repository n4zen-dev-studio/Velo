import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { execute, executeTransaction, queryAll, queryFirst } from "@/services/db/queries"
import type { Workspace } from "@/services/db/types"
import { seedDefaultStatusesForWorkspace, ensureDefaultStatusesForWorkspace } from "@/services/db/repositories/statusesRepository"
import { generateUuidV4, getCurrentUserId } from "@/services/sync/identity"
import { upsertWorkspaceMember } from "@/services/db/repositories/workspaceMembersRepository"
import { getActiveScopeKey } from "@/services/session/scope"

export const PERSONAL_WORKSPACE_LABEL = "Personal"
export const personalWorkspaceId = (scopeKey: string) => `personal:${scopeKey}`

const bootstrapLocks = new Map<string, Promise<void>>()

export async function listWorkspaces(scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const personalId = personalWorkspaceId(resolvedScope)
  return queryAll<Workspace>(
    database,
    "SELECT * FROM workspaces WHERE scopeKey = ? ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, createdAt ASC",
    [resolvedScope, personalId],
  )
}

export async function getWorkspace(id: string, scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryFirst<Workspace>(
    database,
    "SELECT * FROM workspaces WHERE id = ? AND scopeKey = ?",
    [id, resolvedScope],
  )
}

export async function createWorkspace(label: string, scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const now = Date.now()
  const workspace: Workspace = {
    id: await generateUuidV4(),
    label,
    kind: "custom",
    createdAt: now,
    updatedAt: now,
    remoteId: null,
    scopeKey: resolvedScope,
  }

  await execute(
    database,
    `INSERT INTO workspaces (id, label, kind, createdAt, updatedAt, remoteId, scopeKey)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      workspace.id,
      workspace.label,
      workspace.kind,
      workspace.createdAt,
      workspace.updatedAt,
      workspace.remoteId,
      workspace.scopeKey,
    ],
  )

  const userId = await getCurrentUserId()
  if (userId) {
    const timestamp = new Date().toISOString()
    await upsertWorkspaceMember({
      id: await generateUuidV4(),
      workspaceId: workspace.id,
      userId,
      role: "OWNER",
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: `local-${Date.now()}`,
      deletedAt: null,
      scopeKey: resolvedScope,
    })
  }

  await seedDefaultStatusesForWorkspace(workspace.id, resolvedScope, database)
  return workspace
}

export async function upsertWorkspaceFromSync(
  input: Partial<Workspace> & { id: string; label: string },
  scopeKey?: string,
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const now = Date.now()
  const kind = input.kind ?? (input.id.startsWith("personal:") ? "personal" : "custom")
  const workspace: Workspace = {
    id: input.id,
    label: input.label,
    kind,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    remoteId: input.remoteId ?? null,
    scopeKey: input.scopeKey ?? resolvedScope,
  }

  await execute(
    database,
    `INSERT INTO workspaces (id, label, kind, createdAt, updatedAt, remoteId, scopeKey)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       label = excluded.label,
       kind = excluded.kind,
       createdAt = excluded.createdAt,
       updatedAt = excluded.updatedAt,
       remoteId = excluded.remoteId,
       scopeKey = excluded.scopeKey`,
    [
      workspace.id,
      workspace.label,
      workspace.kind,
      workspace.createdAt,
      workspace.updatedAt,
      workspace.remoteId,
      workspace.scopeKey,
    ],
  )

  await ensureDefaultStatusesForWorkspace(workspace.id, resolvedScope, database)

  return workspace
}

export async function renameWorkspace(id: string, label: string, scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const now = Date.now()
  await execute(
    database,
    "UPDATE workspaces SET label = ?, updatedAt = ? WHERE id = ? AND scopeKey = ?",
    [label, now, id, resolvedScope],
  )
}

export async function deleteWorkspace(id: string, scopeKey?: string, db?: SQLiteDatabase) {
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  if (id === personalWorkspaceId(resolvedScope)) {
    throw new Error("Cannot delete Personal workspace")
  }
  const database = db ?? (await getDb())
  await execute(database, "DELETE FROM workspaces WHERE id = ? AND scopeKey = ?", [id, resolvedScope])
}

export async function getActiveWorkspaceId(scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const row = await queryFirst<{ activeWorkspaceId: string }>(
    database,
    "SELECT activeWorkspaceId FROM workspace_state WHERE scopeKey = ?",
    [resolvedScope],
  )
  return row?.activeWorkspaceId ?? null
}

export async function setActiveWorkspaceId(id: string, scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  await execute(
    database,
    `INSERT INTO workspace_state (scopeKey, activeWorkspaceId)
     VALUES (?, ?)
     ON CONFLICT(scopeKey) DO UPDATE SET activeWorkspaceId = excluded.activeWorkspaceId`,
    [resolvedScope, id],
  )
}

export async function ensurePersonalWorkspaceExists(scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const personalId = personalWorkspaceId(resolvedScope)
  const now = Date.now()
  const workspace: Workspace = {
    id: personalId,
    label: PERSONAL_WORKSPACE_LABEL,
    kind: "personal",
    createdAt: now,
    updatedAt: now,
    remoteId: null,
    scopeKey: resolvedScope,
  }
  await execute(
    database,
    `INSERT INTO workspaces (id, label, kind, createdAt, updatedAt, remoteId, scopeKey)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       label = excluded.label,
       kind = excluded.kind,
       updatedAt = excluded.updatedAt,
       remoteId = excluded.remoteId,
       scopeKey = excluded.scopeKey`,
    [
      workspace.id,
      workspace.label,
      workspace.kind,
      workspace.createdAt,
      workspace.updatedAt,
      workspace.remoteId,
      workspace.scopeKey,
    ],
  )
  await ensureDefaultStatusesForWorkspace(workspace.id, resolvedScope, database)
  const refreshed = await getWorkspace(personalId, resolvedScope, database)
  return refreshed ?? workspace
}

export async function ensureActiveWorkspaceIdValid(scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const current = await getActiveWorkspaceId(resolvedScope, database)
  if (!current) {
    const personalId = personalWorkspaceId(resolvedScope)
    await setActiveWorkspaceId(personalId, resolvedScope, database)
    return personalId
  }
  const existing = await getWorkspace(current, resolvedScope, database)
  if (!existing) {
    const personalId = personalWorkspaceId(resolvedScope)
    await setActiveWorkspaceId(personalId, resolvedScope, database)
    return personalId
  }
  return current
}

export async function bootstrapWorkspaces(scopeKey?: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  const existing = bootstrapLocks.get(resolvedScope)
  if (existing) return existing
  const run = executeTransaction(database, async (txDb) => {
    await ensurePersonalWorkspaceExists(resolvedScope, txDb)
    await ensureActiveWorkspaceIdValid(resolvedScope, txDb)
    await ensureDefaultStatusesForWorkspace(personalWorkspaceId(resolvedScope), resolvedScope, txDb)
  }).finally(() => {
    bootstrapLocks.delete(resolvedScope)
  })
  bootstrapLocks.set(resolvedScope, run)
  return run
}
