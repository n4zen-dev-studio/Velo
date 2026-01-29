import type { SQLiteDatabase } from "expo-sqlite"

import { DEFAULT_STATUS_CATALOG } from "@/config/statusCatalog"
import { getDb } from "@/services/db/db"
import { execute, queryAll } from "@/services/db/queries"
import type { Status } from "@/services/db/types"

export async function seedDefaultStatuses(db?: SQLiteDatabase) {
  const database = db ?? (await getDb())

  await Promise.all(
    DEFAULT_STATUS_CATALOG.map((status) =>
      execute(
        database,
        `INSERT INTO statuses (id, projectId, name, orderIndex, category)
         VALUES (?, NULL, ?, ?, ?)
         ON CONFLICT(id, projectId) DO UPDATE SET
           name = excluded.name,
           orderIndex = excluded.orderIndex,
           category = excluded.category`,
        [status.id, status.name, status.orderIndex, status.category],
      ),
    ),
  )
}

export async function listStatuses(projectId: string | null) {
  const database = await getDb()

  const rows = projectId
    ? await queryAll<Status>(
        database,
        `
        SELECT s.*
        FROM statuses s
        WHERE s.projectId IS NULL OR s.projectId = ?
        AND NOT EXISTS (
          SELECT 1 FROM statuses ps
          WHERE ps.projectId = ?
            AND ps.id = s.id
        )
        ORDER BY s.orderIndex
        `,
        [projectId, projectId],
      )
    : await queryAll<Status>(
        database,
        "SELECT * FROM statuses WHERE projectId IS NULL ORDER BY orderIndex",
      )

  // 🔒 FINAL GUARANTEE: no duplicate composite keys
  const seen = new Set<string>()
  return rows.filter((s) => {
    const key = `${s.projectId ?? "personal"}:${s.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

