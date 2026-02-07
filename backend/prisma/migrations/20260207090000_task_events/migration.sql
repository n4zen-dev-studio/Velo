-- CreateTable
CREATE TABLE "task_events" (
    "id" UUID NOT NULL,
    "taskid" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdat" TIMESTAMP(3) NOT NULL,
    "createdbyuserid" UUID NOT NULL,
    "scopekey" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "deletedat" TIMESTAMP(3),

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_events_taskid_idx" ON "task_events"("taskid");

-- CreateIndex
CREATE INDEX "task_events_scopekey_idx" ON "task_events"("scopekey");
