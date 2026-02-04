import { getUserLabelById } from "@/services/db/repositories/usersRepository"
import { ANON_USER_ID } from "@/services/constants/identity"

const ANONYMOUS_LABEL = "Anonymous"

export async function resolveAuthorLabel(params: {
  createdByUserId: string | null | undefined
  currentUserId: string | null | undefined
}) {
  const { createdByUserId, currentUserId } = params
  if (!createdByUserId || createdByUserId === ANON_USER_ID) return ANONYMOUS_LABEL
  if (currentUserId && createdByUserId === currentUserId) {
    return "You"
  }

  const label = await getUserLabelById(createdByUserId)
  if (label) return label

  if (createdByUserId.length >= 4) {
    return `User · ${createdByUserId.slice(-4)}`
  }
  return ANONYMOUS_LABEL
}
