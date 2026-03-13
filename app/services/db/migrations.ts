import type { SQLiteDatabase } from "expo-sqlite"

import { createIndexesSql, createTablesSql, schemaVersion } from "./schema"
import { GUEST_SCOPE_KEY } from "@/services/session/scope"
import { executeSqlBatch, queryAll, queryFirst, executeTransaction, executeTx } from "./queries"

const GUEST_PERSONAL_WORKSPACE_ID = `personal:${GUEST_SCOPE_KEY}`

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
  await executeTx(db, ddl)
  if (backfillSql) {
    await executeTx(db, backfillSql)
  }
}

async function rebuildStatusesTable(db: SQLiteDatabase) {
  const hasTable = await tableExists(db, "statuses")
  if (!hasTable) return
  const hasWorkspaceColumn = await tableHasColumn(db, "statuses", "workspaceId")
  if (hasWorkspaceColumn) return

  await executeTx(
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
  await executeTx(
    db,
    `
    INSERT INTO statuses_new (id, projectId, workspaceId, name, orderIndex, category)
    SELECT id, projectId, '${GUEST_PERSONAL_WORKSPACE_ID}', name, orderIndex, category
    FROM statuses;
    `,
  )
  await executeTx(db, "DROP TABLE statuses;")
  await executeTx(db, "ALTER TABLE statuses_new RENAME TO statuses;")
}

async function rebuildWorkspaceStateTable(db: SQLiteDatabase) {
  const hasTable = await tableExists(db, "workspace_state")
  if (!hasTable) return
  const hasScopeKey = await tableHasColumn(db, "workspace_state", "scopeKey")
  if (hasScopeKey) return

  await executeTx(
    db,
    `
    CREATE TABLE IF NOT EXISTS workspace_state_new (
      scopeKey TEXT PRIMARY KEY,
      activeWorkspaceId TEXT NOT NULL
    );
    `,
  )
  await executeTx(
    db,
    `
    INSERT INTO workspace_state_new (scopeKey, activeWorkspaceId)
    SELECT '${GUEST_SCOPE_KEY}', activeWorkspaceId
    FROM workspace_state
    WHERE id = 'singleton'
    LIMIT 1;
    `,
  )
  await executeTx(db, "DROP TABLE workspace_state;")
  await executeTx(db, "ALTER TABLE workspace_state_new RENAME TO workspace_state;")
}

async function rebuildSyncStateTable(db: SQLiteDatabase) {
  const hasTable = await tableExists(db, "sync_state")
  if (!hasTable) return
  const hasScopeKey = await tableHasColumn(db, "sync_state", "scopeKey")
  if (hasScopeKey) return

  await executeTx(
    db,
    `
    CREATE TABLE IF NOT EXISTS sync_state_new (
      scopeKey TEXT PRIMARY KEY,
      lastCursor TEXT,
      lastSyncedAt TEXT
    );
    `,
  )
  await executeTx(
    db,
    `
    INSERT INTO sync_state_new (scopeKey, lastCursor, lastSyncedAt)
    SELECT '${GUEST_SCOPE_KEY}', lastCursor, lastSyncedAt
    FROM sync_state
    WHERE id = 'singleton'
    LIMIT 1;
    `,
  )
  await executeTx(db, "DROP TABLE sync_state;")
  await executeTx(db, "ALTER TABLE sync_state_new RENAME TO sync_state;")
}

async function rebuildWorkspacesTable(db: SQLiteDatabase) {
  const hasTable = await tableExists(db, "workspaces")
  if (!hasTable) return

  await executeTx(
    db,
    `
    CREATE TABLE IF NOT EXISTS workspaces_new (
      id TEXT NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      remoteId TEXT,
      scopeKey TEXT NOT NULL,
      PRIMARY KEY (id, scopeKey)
    );
    `,
  )
  await executeTx(
    db,
    `
    INSERT INTO workspaces_new (id, label, kind, createdAt, updatedAt, remoteId, scopeKey)
    SELECT id, label, kind, createdAt, updatedAt, remoteId, scopeKey
    FROM workspaces;
    `,
  )
  await executeTx(db, "DROP TABLE workspaces;")
  await executeTx(db, "ALTER TABLE workspaces_new RENAME TO workspaces;")
}

async function migrateSharedWorkspaceScopes(db: SQLiteDatabase) {
  const scopes = await queryAll<{ scopeKey: string }>(
    db,
    "SELECT DISTINCT scopeKey FROM workspaces WHERE scopeKey LIKE 'user:%'",
  )
  for (const { scopeKey } of scopes) {
    const shared = await queryAll<{ workspaceId: string }>(
      db,
      `
      SELECT wm.workspaceId
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspaceId AND w.scopeKey = ?
      WHERE wm.scopeKey = ?
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
      [scopeKey, scopeKey, scopeKey],
    )
    for (const { workspaceId } of shared) {
      const workspaceScope = `workspace:${workspaceId}`
      await executeTx(
        db,
        "UPDATE tasks SET scopeKey = ? WHERE workspaceId = ? AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
      await executeTx(
        db,
        "UPDATE statuses SET scopeKey = ? WHERE workspaceId = ? AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
      await executeTx(
        db,
        "UPDATE projects SET scopeKey = ? WHERE workspaceId = ? AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
      await executeTx(
        db,
        "UPDATE change_log SET scopeKey = ? WHERE workspaceId = ? AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
      await executeTx(
        db,
        "UPDATE task_events SET scopeKey = ? WHERE taskId IN (SELECT id FROM tasks WHERE workspaceId = ?) AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
      await executeTx(
        db,
        "UPDATE comments SET scopeKey = ? WHERE taskId IN (SELECT id FROM tasks WHERE workspaceId = ?) AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
      await executeTx(
        db,
        "UPDATE conflicts SET scopeKey = ? WHERE entityType = 'task' AND entityId IN (SELECT id FROM tasks WHERE workspaceId = ?) AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
      await executeTx(
        db,
        "UPDATE conflicts SET scopeKey = ? WHERE entityType = 'comment' AND entityId IN (SELECT c.id FROM comments c JOIN tasks t ON t.id = c.taskId WHERE t.workspaceId = ?) AND scopeKey LIKE 'user:%'",
        [workspaceScope, workspaceId],
      )
    }
  }
}

async function repairWorkspaceIndexScopes(db: SQLiteDatabase) {
  const scopes = await queryAll<{ scopeKey: string }>(
    db,
    "SELECT DISTINCT scopeKey FROM workspaces WHERE scopeKey LIKE 'user:%'",
  )
  for (const { scopeKey } of scopes) {
    const misplaced = await queryAll<{
      id: string
      label: string
      kind: string
      createdAt: number
      updatedAt: number
      remoteId: string | null
    }>(
      db,
      "SELECT id, label, kind, createdAt, updatedAt, remoteId FROM workspaces WHERE scopeKey LIKE 'workspace:%'",
    )
    for (const row of misplaced) {
      await executeTx(
        db,
        `INSERT INTO workspaces (id, label, kind, createdAt, updatedAt, remoteId, scopeKey)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id, scopeKey) DO UPDATE SET
           label = excluded.label,
           kind = excluded.kind,
           createdAt = excluded.createdAt,
           updatedAt = excluded.updatedAt,
           remoteId = excluded.remoteId`,
        [row.id, row.label, row.kind, row.createdAt, row.updatedAt, row.remoteId, scopeKey],
      )
    }
  }
}

export async function migrate(db: SQLiteDatabase) {
  const versionRow = await queryFirst<{ user_version: number }>(db, "PRAGMA user_version;")
  const currentVersion = versionRow?.user_version ?? 0

  if (currentVersion >= schemaVersion) return

  await executeTransaction(db, async (txDb) => {
    await executeSqlBatch(txDb, createTablesSql)
    await rebuildStatusesTable(txDb)
    await rebuildWorkspaceStateTable(txDb)
    await rebuildSyncStateTable(txDb)

    await ensureColumn(txDb, "users", "username", "ALTER TABLE users ADD COLUMN username TEXT")
    await ensureColumn(
      txDb,
      "users",
      "createdAt",
      "ALTER TABLE users ADD COLUMN createdAt TEXT NOT NULL DEFAULT ''",
      "UPDATE users SET createdAt = COALESCE(createdAt, updatedAt) WHERE createdAt = ''",
    )
    await ensureColumn(
      txDb,
      "users",
      "revision",
      "ALTER TABLE users ADD COLUMN revision TEXT NOT NULL DEFAULT ''",
    )
    await ensureColumn(txDb, "users", "deletedAt", "ALTER TABLE users ADD COLUMN deletedAt TEXT")
    await ensureColumn(
      txDb,
      "users",
      "scopeKey",
      "ALTER TABLE users ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE users SET scopeKey = 'guest' WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "projects",
      "workspaceId",
      "ALTER TABLE projects ADD COLUMN workspaceId TEXT NOT NULL DEFAULT 'personal'",
      "UPDATE projects SET workspaceId = 'personal' WHERE workspaceId IS NULL OR workspaceId = ''",
    )
    await ensureColumn(
      txDb,
      "projects",
      "scopeKey",
      "ALTER TABLE projects ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE projects SET scopeKey = CASE WHEN createdByUserId IS NOT NULL AND createdByUserId != '' THEN 'user:' || createdByUserId ELSE 'guest' END WHERE scopeKey IS NULL OR scopeKey = ''",
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
      "tasks",
      "scopeKey",
      "ALTER TABLE tasks ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE tasks SET scopeKey = CASE WHEN createdByUserId IS NOT NULL AND createdByUserId != '' THEN 'user:' || createdByUserId ELSE 'guest' END WHERE scopeKey IS NULL OR scopeKey = ''",
    )
    await ensureColumn(txDb, "tasks", "startDate", "ALTER TABLE tasks ADD COLUMN startDate TEXT")
    await ensureColumn(txDb, "tasks", "endDate", "ALTER TABLE tasks ADD COLUMN endDate TEXT")
    await ensureColumn(
      txDb,
      "change_log",
      "workspaceId",
      "ALTER TABLE change_log ADD COLUMN workspaceId TEXT NOT NULL DEFAULT 'personal'",
      "UPDATE change_log SET workspaceId = 'personal' WHERE workspaceId IS NULL OR workspaceId = ''",
    )
    await ensureColumn(
      txDb,
      "change_log",
      "scopeKey",
      "ALTER TABLE change_log ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE change_log SET scopeKey = 'user:' || userId WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "comments",
      "scopeKey",
      "ALTER TABLE comments ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE comments SET scopeKey = CASE WHEN createdByUserId IS NOT NULL AND createdByUserId != '' THEN 'user:' || createdByUserId ELSE 'guest' END WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "task_events",
      "scopeKey",
      "ALTER TABLE task_events ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE task_events SET scopeKey = CASE WHEN createdByUserId IS NOT NULL AND createdByUserId != '' THEN 'user:' || createdByUserId ELSE 'guest' END WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "workspace_members",
      "scopeKey",
      "ALTER TABLE workspace_members ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE workspace_members SET scopeKey = 'user:' || userId WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "project_members",
      "scopeKey",
      "ALTER TABLE project_members ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE project_members SET scopeKey = 'user:' || userId WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "workspaces",
      "scopeKey",
      "ALTER TABLE workspaces ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE workspaces SET scopeKey = 'guest' WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "statuses",
      "scopeKey",
      "ALTER TABLE statuses ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE statuses SET scopeKey = 'guest' WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    await ensureColumn(
      txDb,
      "conflicts",
      "scopeKey",
      "ALTER TABLE conflicts ADD COLUMN scopeKey TEXT NOT NULL DEFAULT 'guest'",
      "UPDATE conflicts SET scopeKey = 'guest' WHERE scopeKey IS NULL OR scopeKey = ''",
    )

    if (currentVersion < 5) {
      await rebuildWorkspacesTable(txDb)
    }

    if (currentVersion < 6) {
      await migrateSharedWorkspaceScopes(txDb)
    }

    if (currentVersion < 7) {
      await repairWorkspaceIndexScopes(txDb)
    }

    await executeSqlBatch(txDb, createIndexesSql)
    await executeTx(txDb, `PRAGMA user_version = ${schemaVersion};`)
  })
}
