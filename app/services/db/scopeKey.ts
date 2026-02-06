import type { SQLiteDatabase } from "expo-sqlite"

import { getDb } from "@/services/db/db"
import { queryAll, queryFirst } from "@/services/db/queries"
import { getActiveScopeKey, GUEST_SCOPE_KEY } from "@/services/session/scope"
import { getCurrentUserId } from "@/services/sync/identity"
import type { Workspace } from "@/services/db/types"

const WORKSPACE_SCOPE_PREFIX = "workspace:"

export const workspaceScopeKey = (workspaceId: string) => `${WORKSPACE_SCOPE_PREFIX}${workspaceId}`

export const isWorkspaceScopeKey = (scopeKey: string) => scopeKey.startsWith(WORKSPACE_SCOPE_PREFIX)

export const workspaceIdFromScopeKey = (scopeKey: string) =>
  isWorkspaceScopeKey(scopeKey) ? scopeKey.slice(WORKSPACE_SCOPE_PREFIX.length) : null

export function getScopeKeyForWorkspace(
  workspace: Workspace | null | undefined,
  baseScopeKey: string,
) {
  if (!workspace) return baseScopeKey
  if (baseScopeKey === GUEST_SCOPE_KEY) return baseScopeKey
  if (workspace.kind === "personal") return baseScopeKey
  if (workspace.myRole === "MEMBER") return workspaceScopeKey(workspace.id)
  if ((workspace.membersCount ?? 0) <= 1) return baseScopeKey
  return workspaceScopeKey(workspace.id)
}

export async function resolveWorkspaceScopeKey(
  workspaceId: string,
  scopeKey?: string,
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const baseScope = scopeKey ?? (await getActiveScopeKey())
  if (baseScope === GUEST_SCOPE_KEY) return baseScope
  if (workspaceId.startsWith("personal:")) return baseScope

  const workspace = await queryFirst<{ kind: string }>(
    database,
    "SELECT kind FROM workspaces WHERE id = ? AND scopeKey = ?",
    [workspaceId, baseScope],
  )
  if (workspace?.kind === "personal") return baseScope

  const currentUserId = await getCurrentUserId()
  const membership = await queryFirst<{ role: string }>(
    database,
    "SELECT role FROM workspace_members WHERE scopeKey = ? AND workspaceId = ? AND userId = ? AND deletedAt IS NULL",
    [baseScope, workspaceId, currentUserId],
  )
  if (membership?.role === "MEMBER") {
    return workspaceScopeKey(workspaceId)
  }

  const row = await queryFirst<{ count: number }>(
    database,
    "SELECT COUNT(1) as count FROM workspace_members WHERE scopeKey = ? AND workspaceId = ? AND deletedAt IS NULL",
    [baseScope, workspaceId],
  )
  const count = row?.count ?? 0
  if (count <= 1) return baseScope

  return workspaceScopeKey(workspaceId)
}

export async function listWorkspaceScopeKeys(
  scopeKey?: string,
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const baseScope = scopeKey ?? (await getActiveScopeKey())
  if (baseScope === GUEST_SCOPE_KEY) return []

  const currentUserId = await getCurrentUserId()
  const rows = await queryAll<{ workspaceId: string }>(
    database,
    `
    SELECT wm.workspaceId
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspaceId AND w.scopeKey = ?
    WHERE wm.scopeKey = ?
      AND wm.userId = ?
      AND wm.deletedAt IS NULL
      AND w.kind != 'personal'
      AND (
        wm.role = 'MEMBER'
        OR (
          wm.role = 'OWNER'
          AND (
            SELECT COUNT(1)
            FROM workspace_members wm2
            WHERE wm2.workspaceId = wm.workspaceId
              AND wm2.scopeKey = ?
              AND wm2.deletedAt IS NULL
          ) > 1
        )
      )
    `,
    [baseScope, baseScope, currentUserId, baseScope],
  )
  return rows.map((row) => workspaceScopeKey(row.workspaceId))
}

export async function listAllDataScopeKeys(scopeKey?: string, db?: SQLiteDatabase) {
  const baseScope = scopeKey ?? (await getActiveScopeKey())
  if (baseScope === GUEST_SCOPE_KEY) return [baseScope]
  const workspaceScopes = await listWorkspaceScopeKeys(baseScope, db)
  return [baseScope, ...workspaceScopes]
}

export async function resolveScopeKeyForTaskId(
  taskId: string,
  scopeKey?: string,
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const scopes = await listAllDataScopeKeys(scopeKey, database)
  if (scopes.length === 1) return scopes[0]
  const placeholders = scopes.map(() => "?").join(", ")
  const row = await queryFirst<{ scopeKey: string }>(
    database,
    `SELECT scopeKey FROM tasks WHERE id = ? AND scopeKey IN (${placeholders})`,
    [taskId, ...scopes],
  )
  return row?.scopeKey ?? scopes[0]
}
