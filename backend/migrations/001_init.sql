CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  projectid UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  statusid TEXT NOT NULL,
  priority TEXT NOT NULL,
  assigneeuserid UUID,
  createdbyuserid UUID NOT NULL,
  updatedat TIMESTAMPTZ NOT NULL,
  revision TEXT NOT NULL,
  deletedat TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  taskid UUID NOT NULL,
  body TEXT NOT NULL,
  createdbyuserid UUID NOT NULL,
  createdat TIMESTAMPTZ NOT NULL,
  updatedat TIMESTAMPTZ NOT NULL,
  revision TEXT NOT NULL,
  deletedat TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS op_dedup (
  opid TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS server_changes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  entitytype TEXT NOT NULL,
  entityid TEXT NOT NULL,
  optype TEXT NOT NULL,
  payload JSONB NOT NULL,
  revision TEXT NOT NULL,
  updatedat TIMESTAMPTZ NOT NULL,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_changes_entity ON server_changes (entitytype, entityid);
CREATE INDEX IF NOT EXISTS idx_server_changes_user ON server_changes (user_id, id);
