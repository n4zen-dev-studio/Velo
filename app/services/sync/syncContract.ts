export type SyncEntityType = "task" | "comment"
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
  userId: string
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

export interface SyncConflict {
  entityType: SyncEntityType
  entityId: string
  localBaseRevision: string
  remoteRevision: string
  remotePayload: Record<string, unknown>
}

export interface SyncResponse {
  newCursor: string
  ackOpIds: string[]
  changes: SyncChange[]
  conflicts?: SyncConflict[]
}
