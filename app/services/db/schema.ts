export const schemaVersion = 1

export const createTablesSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  email TEXT,
  avatarUrl TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
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
  name TEXT NOT NULL,
  orderIndex INTEGER NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (id, projectId)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  projectId TEXT,
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
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (projectId);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (statusId);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks (updatedAt);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments (taskId);
CREATE INDEX IF NOT EXISTS idx_change_log_status ON change_log (status);
CREATE INDEX IF NOT EXISTS idx_conflicts_entity ON conflicts (entityType, entityId);
`
