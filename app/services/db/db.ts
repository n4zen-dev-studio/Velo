import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite"

const DB_NAME = "tasktrak.db"
let cachedDb: SQLiteDatabase | null = null

// Centralized so swapping to SQLCipher later only changes this file.
export async function getDb() {
  if (!cachedDb) {
    cachedDb = await openDatabaseAsync(DB_NAME)
  }
  return cachedDb
}

export async function closeDb() {
  if (cachedDb) {
    await cachedDb.closeAsync()
    cachedDb = null
  }
}
