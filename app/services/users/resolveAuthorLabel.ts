import { resolveUserLabel } from "@/utils/userLabel"

export async function resolveAuthorLabel(params: {
  createdByUserId: string | null | undefined
  currentUserId: string | null | undefined
}) {
  const { createdByUserId } = params
  return resolveUserLabel(createdByUserId)
}
