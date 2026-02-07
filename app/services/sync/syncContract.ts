export type SyncEntityType = "task" | "comment" | "task_events" | "user" | "workspace_member" | "workspace"
export type SyncOpType = "UPSERT" | "DELETE"

export interface SyncOpPayload {
  opId: string
  entityType: SyncEntityType
  entityId: string
  opType: SyncOpType
  patch: Record<string, unknown>
  baseRevision: string
  createdAt: string
  projectId: string | null
}

export interface SyncRequest {
  cursor: string | null
  deviceId: string
  ops: SyncOpPayload[]
}

export interface SyncChange {
  entityType: SyncEntityType
  entityId: string
  opType: SyncOpType
  payload: Record<string, unknown>
  revision: string
  updatedAt: string
}

export interface SyncResponse {
  newCursor: string | null
  ackOpIds: string[]
  failed: Array<{ opId: string; message: string }>
  changes: SyncChange[]
}
