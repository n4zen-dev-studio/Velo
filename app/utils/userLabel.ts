import { ANON_USER_ID } from "@/services/constants/identity"
import { getUserById } from "@/services/db/repositories/usersRepository"
import { getCurrentUserId } from "@/services/sync/identity"

export type UserMeta = {
  label: string
  email?: string | null
  username?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

const ANONYMOUS_LABEL = "Anonymous"

export async function resolveUserMeta(userId: string | null | undefined): Promise<UserMeta> {
  if (!userId || userId === ANON_USER_ID) {
    return { label: ANONYMOUS_LABEL }
  }

  const [currentUserId, row] = await Promise.all([getCurrentUserId(), getUserById(userId)])
  const isCurrent = !!currentUserId && currentUserId === userId

  const username = row?.username?.trim() || null
  const email = row?.email?.trim() || null
  const displayName = row?.displayName?.trim() || null
  const avatarUrl = row?.avatarUrl ?? null

  if (isCurrent) {
    return { label: "You", username, email, displayName, avatarUrl }
  }

  const label = username || email || displayName || ANONYMOUS_LABEL
  return { label, username, email, displayName, avatarUrl }
}

export async function resolveUserLabel(userId: string | null | undefined): Promise<string> {
  const meta = await resolveUserMeta(userId)
  return meta.label
}
