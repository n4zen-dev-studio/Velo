import type { SQLiteDatabase } from "expo-sqlite"

import { createIndexesSql, createTablesSql, schemaVersion } from "./schema"
import { queryFirst } from "./queries"

export async function migrate(db: SQLiteDatabase) {
  const versionRow = await queryFirst<{ user_version: number }>(db, "PRAGMA user_version;")
  const currentVersion = versionRow?.user_version ?? 0

  if (currentVersion >= schemaVersion) return

  await db.execAsync("BEGIN")
  try {
    await db.execAsync(createTablesSql)
    await db.execAsync(createIndexesSql)
    await db.execAsync(`PRAGMA user_version = ${schemaVersion};`)
    await db.execAsync("COMMIT")
  } catch (error) {
    await db.execAsync("ROLLBACK")
    throw error
  }
}
