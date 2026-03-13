import { getTaskById, listStatuses, upsertTask } from "@/services/db"
import type { Task } from "@/services/db/types"
import { getActiveScopeKey } from "@/services/session/scope"
import { refreshLocalCounts } from "@/services/sync/syncStore"

export async function updateTaskStatusOnly(taskId: string, nextStatusId: string): Promise<Task> {
  const existing = await getTaskById(taskId)
  console.log("[TaskMutations] updateTaskStatusOnly", {
    taskId,
    found: !!existing,
    existingStatusId: existing?.statusId,
    nextStatusId,
  })
  if (!existing) throw new Error(`Task not found: ${taskId}`)

  // no-op guard
  if (existing.statusId === nextStatusId) return existing

  const now = new Date().toISOString()
  const scopeKey = existing.scopeKey ?? (await getActiveScopeKey())
  const statuses = await listStatuses(existing.workspaceId, existing.projectId ?? null)
  const nextStatus = statuses.find((status) => status.id === nextStatusId)

  const nextRevision = existing.revision
    ? `${existing.revision}-${Date.now()}`
    : `rev-${Date.now()}`

  const updated: Task = {
    ...existing,
    statusId: nextStatusId,
    startDate:
      existing.startDate ?? (nextStatus?.category === "in_progress" ? now : existing.startDate),
    endDate: existing.endDate ?? (nextStatus?.category === "done" ? now : existing.endDate),
    updatedAt: now,
    revision: nextRevision,
    scopeKey,
  }

  await upsertTask(updated)
  await refreshLocalCounts()

  const persisted = await getTaskById(taskId)
  console.log("[TaskMutations] updateTaskStatusOnly persisted", {
    taskId,
    persistedStatusId: persisted?.statusId,
  })
  if (persisted?.statusId !== nextStatusId) {
    throw new Error(
      `Task status update failed for ${taskId}: expected ${nextStatusId}, got ${persisted?.statusId ?? "null"}`,
    )
  }

  return updated
}
