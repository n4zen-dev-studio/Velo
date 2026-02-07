CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);
