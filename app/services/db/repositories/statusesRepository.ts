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
  const sql = projectId
    ? "SELECT * FROM statuses WHERE projectId = ? ORDER BY orderIndex"
    : "SELECT * FROM statuses WHERE projectId IS NULL ORDER BY orderIndex"
  return queryAll<Status>(database, sql, projectId ? [projectId] : [])
}
