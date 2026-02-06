import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite"

import { execute, queryFirst } from "@/services/db/queries"
import { migrate } from "@/services/db/migrations"

const DB_NAME = "tasktrak.db"
let cachedDb: SQLiteDatabase | null = null
let dbPromise: Promise<SQLiteDatabase> | null = null
let initPromise: Promise<void> | null = null

// Centralized so swapping to SQLCipher later only changes this file.
export async function getDb() {
  if (cachedDb) return cachedDb

  if (!dbPromise) {
    if (__DEV__) {
      console.log("[DB] opening database instance")
    }
    dbPromise = openDatabaseAsync(DB_NAME)
  }

  const db = await dbPromise

  if (!initPromise) {
    initPromise = (async () => {
      await execute(db, "PRAGMA foreign_keys = ON;")
      await execute(db, "PRAGMA busy_timeout = 5000;")
      await execute(db, "PRAGMA journal_mode = WAL;")
      await execute(db, "PRAGMA synchronous = NORMAL;")

      await migrate(db)
      const table = await queryFirst<{ name: string }>(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'",
      )
      if (!table) {
        throw new Error("[DB] Schema init failed: tasks table not created")
      }
    })()
  }

  await initPromise
  cachedDb = db
  return db
}


export async function closeDb() {
  if (cachedDb) {
    await cachedDb.closeAsync()
    cachedDb = null
    dbPromise = null
    initPromise = null
  }
}
