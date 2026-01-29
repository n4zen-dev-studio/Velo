import type { SQLiteDatabase } from "expo-sqlite"

const DB_DEBUG = __DEV__

function assertSql(sql: string) {
  if (!sql || typeof sql !== "string") {
    throw new Error(`[DB] Invalid SQL: ${String(sql)}`)
  }
}

function normalizeParams(params?: Record<string, unknown> | unknown[]) {
  return Array.isArray(params) ? params : []
}

function logSql(tag: string, sql: string, params: unknown[]) {
  if (!DB_DEBUG) return
  console.log(`[DB] ${tag}:`, sql.trim(), params)
}

export async function execute(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  assertSql(sql)
  const safeParams = normalizeParams(params)
  logSql("execute", sql, safeParams)
  try {
    const statement = await db.prepareAsync(sql)
    try {
      await statement.executeAsync(safeParams)
    } finally {
      await statement.finalizeAsync()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[DB] execute failed: ${message}\nSQL: ${sql}\nparams: ${JSON.stringify(safeParams)}`)
  }
}

export async function queryAll<T>(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  assertSql(sql)
  const safeParams = normalizeParams(params)
  logSql("queryAll", sql, safeParams)
  try {
    const statement = await db.prepareAsync(sql)
    try {
      const result = await statement.executeAsync<T>(safeParams)
      return await result.getAllAsync()
    } finally {
      await statement.finalizeAsync()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[DB] queryAll failed: ${message}\nSQL: ${sql}\nparams: ${JSON.stringify(safeParams)}`)
  }
}

export async function queryFirst<T>(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  assertSql(sql)
  const safeParams = normalizeParams(params)
  logSql("queryFirst", sql, safeParams)
  try {
    const statement = await db.prepareAsync(sql)
    try {
      const result = await statement.executeAsync<T>(safeParams)
      return await result.getFirstAsync()
    } finally {
      await statement.finalizeAsync()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[DB] queryFirst failed: ${message}\nSQL: ${sql}\nparams: ${JSON.stringify(safeParams)}`)
  }
}

export async function executeTransaction<T>(
  db: SQLiteDatabase,
  task: (txDb: SQLiteDatabase) => Promise<T>,
) {
  await execute(db, "BEGIN")
  try {
    const result = await task(db)
    await execute(db, "COMMIT")
    return result
  } catch (error) {
    await execute(db, "ROLLBACK")
    throw error
  }
}
