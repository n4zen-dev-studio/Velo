ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS workspace_id uuid;
CREATE INDEX IF NOT EXISTS tasks_workspace_id_idx ON tasks(workspace_id);
