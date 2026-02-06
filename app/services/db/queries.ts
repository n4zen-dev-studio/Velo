import type { SQLiteDatabase } from "expo-sqlite"

import { withWriteLock } from "@/services/db/writeLock"

const DB_DEBUG = __DEV__
const DB_DEBUG_TX = DB_DEBUG
let txDepth = 0
let savepointCounter = 0

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

function logTx(tag: string, sql: string, depth: number, savepoint?: string) {
  if (!DB_DEBUG_TX) return
  const suffix = savepoint ? ` (${savepoint})` : ""
  console.log(`[DB] ${tag} depth=${depth}${suffix}:`, sql.trim())
}

function isControlSql(sql: string) {
  const trimmed = sql.trim().toUpperCase()
  return (
    trimmed.startsWith("BEGIN") ||
    trimmed.startsWith("COMMIT") ||
    trimmed.startsWith("ROLLBACK") ||
    trimmed.startsWith("SAVEPOINT") ||
    trimmed.startsWith("RELEASE SAVEPOINT") ||
    trimmed.startsWith("PRAGMA")
  )
}

function isSqliteBusy(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const lowered = message.toLowerCase()
  return lowered.includes("database is locked") || lowered.includes("sqlite_busy")
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isIgnorableControlError(sql: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const lowered = message.toLowerCase()
  const isCommitOrRollback =
    sql.startsWith("COMMIT") ||
    sql.startsWith("ROLLBACK") ||
    sql.startsWith("RELEASE SAVEPOINT") ||
    sql.startsWith("ROLLBACK TO SAVEPOINT")

  if (!isCommitOrRollback) return false
  if (lowered.includes("no transaction is active")) return true
  if (lowered.includes("no such savepoint")) return true
  if (lowered.includes("cannot commit") && lowered.includes("no transaction")) return true
  if (lowered.includes("cannot rollback") && lowered.includes("no transaction")) return true
  return false
}

async function execControl(db: SQLiteDatabase, sql: string) {
  assertSql(sql)
  try {
    if (typeof (db as any).execAsync === "function") {
      await (db as any).execAsync(sql)
      return
    }
    await executeInternal(db, sql)
  } catch (err) {
    if (isIgnorableControlError(sql, err)) {
      if (DB_DEBUG_TX) {
        console.log(`[DB] control ignored:`, sql.trim())
      }
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[DB] control failed: ${message}\nSQL: ${sql}`)
  }
}

async function executeInternal(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  assertSql(sql)
  const safeParams = normalizeParams(params)
  logSql("execute", sql, safeParams)
  const shouldRetry = !isControlSql(sql)
  const maxAttempts = shouldRetry ? 5 : 1
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const statement = await db.prepareAsync(sql)
      try {
        await statement.executeAsync(safeParams)
      } finally {
        await statement.finalizeAsync()
      }
      return
    } catch (err) {
      if (shouldRetry && isSqliteBusy(err) && attempt < maxAttempts) {
        const delay = 30 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 25)
        if (__DEV__) {
          console.warn(`[DB] SQLITE_BUSY retry attempt ${attempt}`, { sql: sql.trim() })
        }
        await sleep(delay)
        continue
      }
      if (isSqliteBusy(err)) {
        const stack = new Error("[DB][BUSY] stack").stack
        console.warn("[DB][BUSY] sql=", sql.trim())
        console.warn("[DB][BUSY] params=", safeParams)
        console.warn("[DB][BUSY] txDepth=", txDepth)
        if (__DEV__ && stack) {
          console.warn(stack)
        }
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`[DB] execute failed: ${message}\nSQL: ${sql}\nparams: ${JSON.stringify(safeParams)}`)
    }
  }
}

export async function executeSqlBatch(db: SQLiteDatabase, sqlText: string) {
  assertSql(sqlText)
  const statements = sqlText
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .filter((statement) => !statement.startsWith("--") && !statement.startsWith("//") && !statement.startsWith("/*"))

  for (const statement of statements) {
    await executeInternal(db, statement)
  }
}

export async function execute(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  if (txDepth > 0) {
    if (__DEV__) {
      console.warn("[DB] execute called inside transaction; use executeTx instead")
      console.warn(new Error("[DB] execute misuse").stack)
    }
    return executeInternal(db, sql, params)
  }
  return withWriteLock(() => executeInternal(db, sql, params))
}

export async function executeTx(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  return executeInternal(db, sql, params)
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

export async function queryAllTx<T>(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  return queryAll<T>(db, sql, params)
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

export async function queryFirstTx<T>(
  db: SQLiteDatabase,
  sql: string,
  params?: Record<string, unknown> | unknown[],
) {
  return queryFirst<T>(db, sql, params)
}

export function isInTransaction() {
  return txDepth > 0
}
export async function executeTransaction<T>(
  db: SQLiteDatabase,
  task: (txDb: SQLiteDatabase) => Promise<T>,
) {
  return withWriteLock(async () => {
    const isOuter = txDepth === 0
    const savepointName = isOuter ? null : `sp_${Date.now()}_${++savepointCounter}`
    txDepth += 1

    try {
      if (isOuter) {
        logTx("BEGIN", "BEGIN IMMEDIATE", txDepth)
        await execControl(db, "BEGIN IMMEDIATE")
      } else if (savepointName) {
        logTx("SAVEPOINT", `SAVEPOINT ${savepointName}`, txDepth, savepointName)
        await execControl(db, `SAVEPOINT ${savepointName}`)
      }

      const result = await task(db)

      if (isOuter) {
        logTx("COMMIT", "COMMIT", txDepth)
        await execControl(db, "COMMIT")
      } else if (savepointName) {
        logTx("RELEASE", `RELEASE SAVEPOINT ${savepointName}`, txDepth, savepointName)
        await execControl(db, `RELEASE SAVEPOINT ${savepointName}`)
      }

      return result
    } catch (error) {
      if (isOuter) {
        logTx("ROLLBACK", "ROLLBACK", txDepth)
        await execControl(db, "ROLLBACK")
      } else if (savepointName) {
        logTx("ROLLBACK TO", `ROLLBACK TO SAVEPOINT ${savepointName}`, txDepth, savepointName)
        await execControl(db, `ROLLBACK TO SAVEPOINT ${savepointName}`)
        logTx("RELEASE", `RELEASE SAVEPOINT ${savepointName}`, txDepth, savepointName)
        await execControl(db, `RELEASE SAVEPOINT ${savepointName}`)
      }
      throw error
    } finally {
      txDepth = Math.max(0, txDepth - 1)
    }
  })
}
