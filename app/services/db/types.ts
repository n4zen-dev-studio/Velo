export type Priority = "low" | "medium" | "high"
export type ProjectRole = "admin" | "member"
export type ChangeLogStatus = "PENDING" | "SENT" | "FAILED"
export type ChangeLogOpType = "UPSERT" | "DELETE"

export interface User {
  id: string
  displayName: string | null
  username: string | null
  email: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  revision: string
  deletedAt: string | null
}

export interface Project {
  id: string
  name: string
  workspaceId: string
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
  workspaceId: string
  name: string
  orderIndex: number
  category: "todo" | "in_progress" | "done"
}

export interface Workspace {
  id: string
  label: string
  kind: "personal" | "custom"
  createdAt: number
  updatedAt: number
  remoteId: string | null
}

export interface Task {
  id: string
  projectId: string | null
  workspaceId: string
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

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: "OWNER" | "MEMBER" | string
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
  workspaceId: string
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
