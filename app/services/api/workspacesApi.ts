import type { AxiosInstance } from "axios"

export interface WorkspaceMemberResponse {
  id: string
  workspaceId: string
  userId: string
  role: string
  createdAt: string
  updatedAt: string
  revision: string
  deletedAt: string | null
  user: {
    id: string
    email: string | null
    username: string | null
    displayName: string | null
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
    revision: string
    deletedAt: string | null
  } | null
}

export async function listWorkspaceMembers(client: AxiosInstance, workspaceId: string) {
  const response = await client.get<WorkspaceMemberResponse[]>(
    `/workspaces/${workspaceId}/members`,
  )
  return response.data
}
