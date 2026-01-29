import type { SQLiteDatabase } from "expo-sqlite"

export async function execute(db: SQLiteDatabase, sql: string, params?: Record<string, unknown> | unknown[]) {
  const statement = await db.prepareAsync(sql)
  try {
    await statement.executeAsync(params ?? [])
  } finally {
    await statement.finalizeAsync()
  }
}

export async function queryAll<T>(db: SQLiteDatabase, sql: string, params?: Record<string, unknown> | unknown[]) {
  const statement = await db.prepareAsync(sql)
  try {
    const result = await statement.executeAsync<T>(params ?? [])
    return await result.getAllAsync()
  } finally {
    await statement.finalizeAsync()
  }
}

export async function queryFirst<T>(db: SQLiteDatabase, sql: string, params?: Record<string, unknown> | unknown[]) {
  const statement = await db.prepareAsync(sql)
  try {
    const result = await statement.executeAsync<T>(params ?? [])
    return await result.getFirstAsync()
  } finally {
    await statement.finalizeAsync()
  }
}
