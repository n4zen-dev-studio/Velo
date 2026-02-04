export const schemaVersion = 3

export const createTablesSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  displayName TEXT,
  username TEXT,
  email TEXT,
  avatarUrl TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  revision TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  remoteId TEXT
);

CREATE TABLE IF NOT EXISTS workspace_state (
  id TEXT PRIMARY KEY,
  activeWorkspaceId TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspaceId TEXT NOT NULL,
  createdByUserId TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  archivedAt TEXT
);

CREATE TABLE IF NOT EXISTS project_members (
  projectId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL,
  joinedAt TEXT NOT NULL,
  PRIMARY KEY (projectId, userId)
);

CREATE TABLE IF NOT EXISTS statuses (
  id TEXT NOT NULL,
  projectId TEXT,
  workspaceId TEXT NOT NULL,
  name TEXT NOT NULL,
  orderIndex INTEGER NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (id, projectId, workspaceId)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  projectId TEXT,
  workspaceId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  statusId TEXT NOT NULL,
  priority TEXT NOT NULL,
  assigneeUserId TEXT,
  createdByUserId TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  revision TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  body TEXT NOT NULL,
  createdByUserId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  revision TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  revision TEXT NOT NULL,
  deletedAt TEXT,
  UNIQUE(workspaceId, userId)
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdByUserId TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS change_log (
  opId TEXT PRIMARY KEY,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  opType TEXT NOT NULL,
  patch TEXT NOT NULL,
  baseRevision TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  deviceId TEXT NOT NULL,
  userId TEXT NOT NULL,
  projectId TEXT,
  workspaceId TEXT NOT NULL,
  status TEXT NOT NULL,
  attemptCount INTEGER NOT NULL,
  lastAttemptAt TEXT
);

CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  localRevision TEXT NOT NULL,
  remoteRevision TEXT NOT NULL,
  localPayload TEXT NOT NULL,
  remotePayload TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY,
  lastCursor TEXT,
  lastSyncedAt TEXT
);
`

export const createIndexesSql = `
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects (workspaceId);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (projectId);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks (workspaceId);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (statusId);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks (updatedAt);
CREATE INDEX IF NOT EXISTS idx_statuses_workspace ON statuses (workspaceId, projectId);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments (taskId);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members (workspaceId);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members (userId);
CREATE INDEX IF NOT EXISTS idx_change_log_status ON change_log (status);
CREATE INDEX IF NOT EXISTS idx_change_log_workspace ON change_log (workspaceId);
CREATE INDEX IF NOT EXISTS idx_conflicts_entity ON conflicts (entityType, entityId);
`
