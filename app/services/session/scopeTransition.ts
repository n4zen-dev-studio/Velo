import { getStoredUserId } from "@/services/sync/identity"

let tail: Promise<unknown> = Promise.resolve()
let seq = 0

export function logScopeAction(action: string, scopeKey?: string, userId?: string | null) {
  if (!__DEV__) return
  const timestamp = new Date().toISOString()
  console.log(`[SCOPE] action=${action} scopeKey=${scopeKey ?? "unknown"} userId=${userId ?? "unknown"} time=${timestamp}`)
}

export async function withScopeTransitionLock<T>(fn: () => Promise<T>, action?: string) {
  const id = ++seq
  const run = tail.then(async () => {
    const userId = await getStoredUserId()
    if (__DEV__) {
      console.log(`[SCOPE] lock acquire #${id}`)
      if (action) logScopeAction(action, undefined, userId)
    }
    try {
      return await fn()
    } finally {
      if (__DEV__) console.log(`[SCOPE] lock release #${id}`)
    }
  })

  tail = run.catch(() => undefined)
  return run
}
