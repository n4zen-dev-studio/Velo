import type { AxiosInstance } from "axios"

export interface InviteSummary {
  id: string
  token: string
  workspace: { id: string; label: string }
  role: string
  expiresAt: string
  invitedBy: { id: string; email: string }
}

export interface WorkspaceInvite {
  id: string
  email: string
  role: string
  status: string
  expiresAt: string
  createdAt: string
  invitedById: string
  acceptedAt?: string | null
}

export interface InviteAcceptResponse {
  ok: boolean
  workspace: { id: string; label: string; kind?: string }
  membership: {
    id: string
    workspaceId: string
    userId: string
    role: string
    createdAt: string
    updatedAt: string
    revision: string
    deletedAt: string | null
  } | null
  invite: { id: string; status: string; acceptedAt: string | null }
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
  const response = await client.post<InviteAcceptResponse>(`/invites/${token}/accept`)
  return response.data
}

export async function listMyInvites(client: AxiosInstance) {
  const response = await client.get<InviteSummary[]>("/me/invites")
  return response.data
}

export async function listWorkspaceInvites(client: AxiosInstance, workspaceId: string) {
  const response = await client.get<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`)
  return response.data
}

export async function revokeWorkspaceInvite(
  client: AxiosInstance,
  workspaceId: string,
  inviteId: string,
) {
  const response = await client.post<{ ok: boolean }>(
    `/workspaces/${workspaceId}/invites/${inviteId}/revoke`,
  )
  return response.data
}

export async function removeWorkspaceMember(
  client: AxiosInstance,
  workspaceId: string,
  userId: string,
) {
  const response = await client.delete<{ ok: boolean }>(
    `/workspaces/${workspaceId}/members/${userId}`,
  )
  return response.data
}

export async function deleteWorkspace(client: AxiosInstance, workspaceId: string) {
  const response = await client.delete<{ ok: boolean }>(`/workspaces/${workspaceId}`)
  return response.data
}
