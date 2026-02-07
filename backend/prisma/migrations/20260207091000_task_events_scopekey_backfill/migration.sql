-- Backfill task_events.scopekey for existing rows
UPDATE "task_events" te
SET "scopekey" = 'workspace:' || t."workspace_id"::text
FROM "tasks" t
WHERE te."taskid" = t."id"
  AND (te."scopekey" IS NULL OR te."scopekey" = '');
