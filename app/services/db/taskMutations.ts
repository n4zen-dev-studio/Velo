import { getTaskById, upsertTask } from "@/services/db"
import type { Task } from "@/services/db/types"
import { getActiveScopeKey } from "@/services/session/scope"
import { getCurrentUserId } from "@/services/sync/identity"
import { refreshLocalCounts } from "@/services/sync/syncStore"

export async function updateTaskStatusOnly(taskId: string, nextStatusId: string): Promise<Task> {
  const existing = await getTaskById(taskId)
  if (!existing) throw new Error(`Task not found: ${taskId}`)

  // no-op guard
  if (existing.statusId === nextStatusId) return existing

  const now = new Date().toISOString()
  const _currentUserId = await getCurrentUserId() // kept for parity; not used unless you want to.
  const scopeKey = await getActiveScopeKey()

  const nextRevision = existing.revision
    ? `${existing.revision}-${Date.now()}`
    : `rev-${Date.now()}`

  const updated: Task = {
    ...existing,
    statusId: nextStatusId,
    updatedAt: now,
    revision: nextRevision,
    scopeKey,
  }

  await upsertTask(updated)
  await refreshLocalCounts()

  return updated
}
