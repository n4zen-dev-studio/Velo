import type { SQLiteDatabase } from "expo-sqlite"

import { DEFAULT_STATUS_CATALOG } from "@/config/statusCatalog"
import { getDb } from "@/services/db/db"
import { execute, executeTx, queryAll, queryFirst, queryFirstTx } from "@/services/db/queries"
import type { Status } from "@/services/db/types"
import { resolveWorkspaceScopeKey } from "@/services/db/scopeKey"

export async function seedDefaultStatusesForWorkspace(
  workspaceId: string,
  scopeKey?: string,
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const exec = db ? executeTx : execute
  const resolvedScope = await resolveWorkspaceScopeKey(workspaceId, scopeKey, database)
  for (const status of DEFAULT_STATUS_CATALOG) {
    await exec(
      database,
      `INSERT INTO statuses (id, projectId, workspaceId, name, orderIndex, category, scopeKey)
       VALUES (?, NULL, ?, ?, ?, ?, ?)
       ON CONFLICT(id, projectId, workspaceId) DO UPDATE SET
         name = excluded.name,
         orderIndex = excluded.orderIndex,
         category = excluded.category,
         scopeKey = excluded.scopeKey`,
      [status.id, workspaceId, status.name, status.orderIndex, status.category, resolvedScope],
    )
  }
}

export async function ensureDefaultStatusesForWorkspace(
  workspaceId: string,
  scopeKey?: string,
  db?: SQLiteDatabase,
) {
  const database = db ?? (await getDb())
  const queryFirstFn = db ? queryFirstTx : queryFirst
  const resolvedScope = await resolveWorkspaceScopeKey(workspaceId, scopeKey, database)
  const row = await queryFirstFn<{ count: number }>(
    database,
    "SELECT COUNT(1) as count FROM statuses WHERE scopeKey = ? AND workspaceId = ? AND projectId IS NULL",
    [resolvedScope, workspaceId],
  )
  if ((row?.count ?? 0) === 0) {
    await seedDefaultStatusesForWorkspace(workspaceId, resolvedScope, database)
  }
}

export async function listStatuses(workspaceId: string, projectId?: string | null, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = await resolveWorkspaceScopeKey(workspaceId, scopeKey, database)

  const isProjectScoped = projectId !== null && projectId !== undefined
  const rows = isProjectScoped
    ? await queryAll<Status>(
        database,
        `
        SELECT s.*
        FROM statuses s
        WHERE s.scopeKey = ?
          AND s.workspaceId = ?
          AND (s.projectId IS NULL OR s.projectId = ?)
        AND NOT EXISTS (
          SELECT 1 FROM statuses ps
          WHERE ps.scopeKey = ?
            AND ps.workspaceId = ?
            AND ps.projectId = ?
            AND ps.id = s.id
        )
        ORDER BY s.orderIndex
        `,
        [resolvedScope, workspaceId, projectId, resolvedScope, workspaceId, projectId],
      )
    : await queryAll<Status>(
        database,
        "SELECT * FROM statuses WHERE scopeKey = ? AND workspaceId = ? AND projectId IS NULL ORDER BY orderIndex",
        [resolvedScope, workspaceId],
      )

  // 🔒 FINAL GUARANTEE: no duplicate composite keys
  const seen = new Set<string>()
  return rows.filter((s) => {
    const key = `${s.workspaceId}:${s.projectId ?? "personal"}:${s.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
