const listeners = new Set<() => void>()
let queuedTimer: ReturnType<typeof setTimeout> | null = null

export function subscribeQueuedSyncChange(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyQueuedSyncChange() {
  if (queuedTimer) return
  queuedTimer = setTimeout(() => {
    queuedTimer = null
    listeners.forEach((listener) => listener())
  }, 0)
}
