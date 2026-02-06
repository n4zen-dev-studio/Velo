let tail: Promise<unknown> = Promise.resolve()
let lockCounter = 0

export async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const id = ++lockCounter
  const run = tail.then(async () => {
    if (__DEV__) console.log(`[DB] writeLock acquired #${id}`)
    if (__DEV__) console.log(new Error("[DB][LOCK] caller").stack)
    try {
      return await fn()
    } finally {
      if (__DEV__) console.log(`[DB] writeLock released #${id}`)
    }
  })

  tail = run.catch(() => undefined)
  return run
}
