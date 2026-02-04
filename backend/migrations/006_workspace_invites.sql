CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  workspace_label TEXT NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  invited_by_id UUID NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_id UUID
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id ON workspace_invites (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites (email);
