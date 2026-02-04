import { getDb } from "@/services/db/db"
import { queryFirst } from "@/services/db/queries"

interface UserRow {
  displayName: string | null
  email: string | null
}

export async function getUserLabelById(userId: string) {
  const database = await getDb()
  const row = await queryFirst<UserRow>(
    database,
    "SELECT displayName, email FROM users WHERE id = ? LIMIT 1",
    [userId],
  )
  if (!row) return null
  const displayName = row.displayName?.trim()
  if (displayName) return displayName
  const email = row.email?.trim()
  if (email) return email
  return null
}
