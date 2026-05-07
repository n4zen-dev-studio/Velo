import type { SQLiteDatabase } from "expo-sqlite"

import { createIndexesSql, createTablesSql, schemaVersion } from "./schema"
import { execute, executeSqlBatch, queryAll, queryFirst, executeTransaction } from "./queries"

const PERSONAL_WORKSPACE_ID = "personal"

async function tableHasColumn(db: SQLiteDatabase, table: string, column: string) {
  const rows = await queryAll<{ name: string }>(db, `PRAGMA table_info(${table});`)
  return rows.some((row) => row.name === column)
}

async function tableExists(db: SQLiteDatabase, table: string) {
  const row = await queryFirst<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table],
  )
  return Boolean(row?.name)
}

async function ensureColumn(
  db: SQLiteDatabase,
  table: string,
  column: string,
  ddl: string,
  backfillSql?: string,
) {
  const hasColumn = await tableHasColumn(db, table, column)
  if (hasColumn) return
  await execute(db, ddl)
  if (backfillSql) {
    await execute(db, backfillSql)
  }
}

async function rebuildStatusesTable(db: SQLiteDatabase) {
  const hasTable = await tableExists(db, "statuses")
  if (!hasTable) return
  const hasWorkspaceColumn = await tableHasColumn(db, "statuses", "workspaceId")
  if (hasWorkspaceColumn) return

  await execute(
    db,
    `
    CREATE TABLE IF NOT EXISTS statuses_new (
      id TEXT NOT NULL,
      projectId TEXT,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      orderIndex INTEGER NOT NULL,
      category TEXT NOT NULL,
      PRIMARY KEY (id, projectId, workspaceId)
    );
    `,
  )
  await execute(
    db,
    `
    INSERT INTO statuses_new (id, projectId, workspaceId, name, orderIndex, category)
    SELECT id, projectId, '${PERSONAL_WORKSPACE_ID}', name, orderIndex, category
    FROM statuses;
    `,
  )
  await execute(db, "DROP TABLE statuses;")
  await execute(db, "ALTER TABLE statuses_new RENAME TO statuses;")
}

export async function migrate(db: SQLiteDatabase) {
  const versionRow = await queryFirst<{ user_version: number }>(db, "PRAGMA user_version;")
  const currentVersion = versionRow?.user_version ?? 0

  if (currentVersion >= schemaVersion) return

  await executeTransaction(db, async (txDb) => {
    await executeSqlBatch(txDb, createTablesSql)
    await rebuildStatusesTable(txDb)

    await ensureColumn(
      txDb,
      "projects",
      "workspaceId",
      "ALTER TABLE projects ADD COLUMN workspaceId TEXT NOT NULL DEFAULT 'personal'",
      "UPDATE projects SET workspaceId = 'personal' WHERE workspaceId IS NULL OR workspaceId = ''",
    )
    await ensureColumn(
      txDb,
      "tasks",
      "workspaceId",
      "ALTER TABLE tasks ADD COLUMN workspaceId TEXT NOT NULL DEFAULT 'personal'",
      "UPDATE tasks SET workspaceId = 'personal' WHERE workspaceId IS NULL OR workspaceId = ''",
    )
    await ensureColumn(
      txDb,
      "change_log",
      "workspaceId",
      "ALTER TABLE change_log ADD COLUMN workspaceId TEXT NOT NULL DEFAULT 'personal'",
      "UPDATE change_log SET workspaceId = 'personal' WHERE workspaceId IS NULL OR workspaceId = ''",
    )

    await executeSqlBatch(txDb, createIndexesSql)
    await execute(txDb, `PRAGMA user_version = ${schemaVersion};`)
  })
}
