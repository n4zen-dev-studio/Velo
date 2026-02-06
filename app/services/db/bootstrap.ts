import { getDb } from "./db"
import { bootstrapWorkspaces } from "./repositories/workspacesRepository"
import { isLoggingOut } from "@/services/session/logoutState"

const inflight = new Map<string, Promise<void>>()

export async function ensureBootstrappedForScope(scopeKey: string) {
  if (isLoggingOut()) return
  const existing = inflight.get(scopeKey)
  if (existing) return existing

  const run = (async () => {
    if (__DEV__) console.log(`[DB] bootstrap start scopeKey=${scopeKey}`)
    const db = await getDb()
    await bootstrapWorkspaces(scopeKey, db)
    if (__DEV__) console.log(`[DB] bootstrap end scopeKey=${scopeKey}`)
  })().finally(() => {
    inflight.delete(scopeKey)
  })

  inflight.set(scopeKey, run)
  return run
}
