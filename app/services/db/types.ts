export type Priority = "low" | "medium" | "high"
export type ProjectRole = "admin" | "member"
export type ChangeLogStatus = "PENDING" | "SENT" | "FAILED"
export type ChangeLogOpType = "UPSERT" | "DELETE"

export interface User {
  id: string
  displayName: string
  email?: string | null
  avatarUrl?: string | null
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  createdByUserId: string
  updatedAt: string
  archivedAt: string | null
}

export interface ProjectMember {
  projectId: string
  userId: string
  role: ProjectRole
  joinedAt: string
}

export interface Status {
  id: string
  projectId: string | null
  name: string
  orderIndex: number
  category: "todo" | "in_progress" | "done"
}

export interface Task {
  id: string
  projectId: string | null
  title: string
  description: string
  statusId: string
  priority: Priority
  assigneeUserId: string | null
  createdByUserId: string
  updatedAt: string
  revision: string
  deletedAt: string | null
}

export interface Comment {
  id: string
  taskId: string
  body: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
  revision: string
  deletedAt: string | null
}

export interface TaskEvent {
  id: string
  taskId: string
  type: string
  payload: string
  createdAt: string
  createdByUserId: string
}

export interface ChangeLogEntry {
  opId: string
  entityType: string
  entityId: string
  opType: ChangeLogOpType
  patch: string
  baseRevision: string
  createdAt: string
  deviceId: string
  userId: string
  projectId: string | null
  status: ChangeLogStatus
  attemptCount: number
  lastAttemptAt: string | null
}

export interface ConflictRecord {
  id: string
  entityType: string
  entityId: string
  localRevision: string
  remoteRevision: string
  localPayload: string
  remotePayload: string
  status: "OPEN" | "RESOLVED"
  createdAt: string
  resolvedAt: string | null
}

export interface SyncState {
  id: string
  lastCursor: string | null
  lastSyncedAt: string | null
}
