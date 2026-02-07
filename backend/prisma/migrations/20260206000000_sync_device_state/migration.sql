CREATE TABLE IF NOT EXISTS "sync_device_state" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "last_cursor" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "sync_device_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_device_state_user_id_device_id_key" ON "sync_device_state" ("user_id", "device_id");
CREATE INDEX IF NOT EXISTS "sync_device_state_user_id_last_cursor_idx" ON "sync_device_state" ("user_id", "last_cursor");

ALTER TABLE "sync_device_state"
ADD CONSTRAINT "sync_device_state_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "server_changes_user_id_id_idx" ON "server_changes" ("user_id", "id");
