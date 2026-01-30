import { Pool } from "pg"
import dotenv from "dotenv"

dotenv.config()

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query<T = unknown>(text: string, params: unknown[] = []) {
  const result = await pool.query<T>(text, params)
  return result
}
