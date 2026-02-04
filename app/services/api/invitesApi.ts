import type { AxiosInstance } from "axios"

export interface InviteSummary {
  id: string
  token: string
  workspace: { id: string; label: string }
  role: string
  expiresAt: string
  invitedBy: { id: string; email: string }
}

export async function inviteToWorkspace(
  client: AxiosInstance,
  workspaceId: string,
  email: string,
  workspaceLabel?: string,
) {
  const response = await client.post<{ ok: boolean }>(`/workspaces/${workspaceId}/invites`, {
    email,
    workspaceLabel,
  })
  return response.data
}

export async function getInvite(client: AxiosInstance, token: string) {
  const response = await client.get<{
    workspace: { id: string; label: string }
    email: string
    status: string
    expiresAt: string
  }>(`/invites/${token}`)
  return response.data
}

export async function acceptInvite(client: AxiosInstance, token: string) {
  const response = await client.post<{ ok: boolean; workspaceId: string }>(
    `/invites/${token}/accept`,
  )
  return response.data
}

export async function listMyInvites(client: AxiosInstance) {
  const response = await client.get<InviteSummary[]>("/me/invites")
  return response.data
}
