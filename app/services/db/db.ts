import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite"

import { createIndexesSql, createTablesSql } from "@/services/db/schema"
import { executeTransaction, execute } from "@/services/db/queries"
import { seedDefaultStatuses } from "@/services/db/repositories/statusesRepository"

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
      // 🔹 PRAGMAs MUST be outside transaction
      await execute(db, "PRAGMA journal_mode = WAL;")
      await execute(db, "PRAGMA synchronous = NORMAL;")
      await execute(db, "PRAGMA foreign_keys = ON;")
      await execute(db, "PRAGMA busy_timeout = 5000;")

      // 🔹 Everything else inside ONE transaction
      await executeTransaction(db, async (txDb) => {
        await execute(txDb, createTablesSql)
        await execute(txDb, createIndexesSql)
        await seedDefaultStatuses(txDb)
      })
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
