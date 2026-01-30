import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function ensureMigrationsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

async function getApplied() {
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM schema_migrations`
  return new Set(rows.map((row) => row.id))
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
    await prisma.$executeRawUnsafe("BEGIN")
    try {
      await prisma.$executeRawUnsafe(sql)
      await prisma.$executeRawUnsafe("INSERT INTO schema_migrations (id) VALUES ($1)", file)
      await prisma.$executeRawUnsafe("COMMIT")
    } catch (error) {
      await prisma.$executeRawUnsafe("ROLLBACK")
      throw error
    }
  }
}

applyMigrations()
  .then(async () => {
    console.log("[migrate] done")
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error("[migrate] failed", error)
    await prisma.$disconnect()
    process.exit(1)
  })
