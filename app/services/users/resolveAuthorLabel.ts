import { getCurrentUserId, getSessionMode } from "@/services/sync/identity"
import { getUserLabelById } from "@/services/db/repositories/usersRepository"
import { ANON_USER_ID } from "@/services/constants/identity"

const ANONYMOUS_LABEL = "Anonymous"

export async function resolveAuthorLabel(createdByUserId?: string | null) {
  if (!createdByUserId || createdByUserId === ANON_USER_ID) return ANONYMOUS_LABEL

  const sessionMode = await getSessionMode()
  if (sessionMode !== "remote") {
    return ANONYMOUS_LABEL
  }

  const currentUserId = await getCurrentUserId()
  if (currentUserId === createdByUserId) {
    return "You"
  }

  const label = await getUserLabelById(createdByUserId)
  if (label) return label

  if (createdByUserId.length >= 4) {
    return `User · ${createdByUserId.slice(-4)}`
  }
  return ANONYMOUS_LABEL
}
