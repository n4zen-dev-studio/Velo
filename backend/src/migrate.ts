import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { pool } from "./db"

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

async function getApplied() {
  const result = await pool.query<{ id: string }>("SELECT id FROM schema_migrations")
  return new Set(result.rows.map((row) => row.id))
}

async function applyMigrations() {
  await ensureMigrationsTable()
  const applied = await getApplied()
  const migrationsDir = join(process.cwd(), "migrations")
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), "utf8")
    console.log(`[migrate] applying ${file}`)
    await pool.query("BEGIN")
    try {
      await pool.query(sql)
      await pool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file])
      await pool.query("COMMIT")
    } catch (error) {
      await pool.query("ROLLBACK")
      throw error
    }
  }
}

applyMigrations()
  .then(() => {
    console.log("[migrate] done")
    return pool.end()
  })
  .catch((error) => {
    console.error("[migrate] failed", error)
    process.exit(1)
  })
