import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite"

import { migrate } from "@/services/db/migrations"

const DB_NAME = "tasktrak.db"
let cachedDb: SQLiteDatabase | null = null
let dbPromise: Promise<SQLiteDatabase> | null = null
let initPromise: Promise<void> | null = null

// Centralized so swapping to SQLCipher later only changes this file.
export async function getDb() {
  if (cachedDb) return cachedDb
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DB_NAME)
  }
  const db = await dbPromise
  if (!initPromise) {
    initPromise = (async () => {
      await migrate(db)
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
