import type { SQLiteDatabase } from "expo-sqlite"

import { DEFAULT_STATUS_CATALOG } from "@/config/statusCatalog"
import { getDb } from "@/services/db/db"
import { execute, queryAll, queryFirst } from "@/services/db/queries"
import type { Status } from "@/services/db/types"

export async function seedDefaultStatusesForWorkspace(workspaceId: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  for (const status of DEFAULT_STATUS_CATALOG) {
    await execute(
      database,
      `INSERT INTO statuses (id, projectId, workspaceId, name, orderIndex, category)
       VALUES (?, NULL, ?, ?, ?, ?)
       ON CONFLICT(id, projectId, workspaceId) DO UPDATE SET
         name = excluded.name,
         orderIndex = excluded.orderIndex,
         category = excluded.category`,
      [status.id, workspaceId, status.name, status.orderIndex, status.category],
    )
  }
}

export async function ensureDefaultStatusesForWorkspace(workspaceId: string, db?: SQLiteDatabase) {
  const database = db ?? (await getDb())
  const row = await queryFirst<{ count: number }>(
    database,
    "SELECT COUNT(1) as count FROM statuses WHERE workspaceId = ? AND projectId IS NULL",
    [workspaceId],
  )
  if ((row?.count ?? 0) === 0) {
    await seedDefaultStatusesForWorkspace(workspaceId, database)
  }
}

export async function listStatuses(workspaceId: string, projectId?: string | null) {
  const database = await getDb()

  const isProjectScoped = projectId !== null && projectId !== undefined
  const rows = isProjectScoped
    ? await queryAll<Status>(
        database,
        `
        SELECT s.*
        FROM statuses s
        WHERE s.workspaceId = ?
          AND (s.projectId IS NULL OR s.projectId = ?)
        AND NOT EXISTS (
          SELECT 1 FROM statuses ps
          WHERE ps.workspaceId = ?
            AND ps.projectId = ?
            AND ps.id = s.id
        )
        ORDER BY s.orderIndex
        `,
        [workspaceId, projectId, workspaceId, projectId],
      )
    : await queryAll<Status>(
        database,
        "SELECT * FROM statuses WHERE workspaceId = ? AND projectId IS NULL ORDER BY orderIndex",
        [workspaceId],
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
