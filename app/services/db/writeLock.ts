let writeChain: Promise<unknown> = Promise.resolve()
let lockCounter = 0
let writeDepth = 0

export async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  if (writeDepth > 0) return fn()
  const id = ++lockCounter
  if (__DEV__) console.log(`[DB] write lock start #${id}`)
  const run = writeChain.then(async () => {
    writeDepth += 1
    try {
      return await fn()
    } finally {
      writeDepth -= 1
    }
  })
  writeChain = run.then(
    () => {
      if (__DEV__) console.log(`[DB] write lock end #${id}`)
    },
    () => {
      if (__DEV__) console.log(`[DB] write lock end #${id}`)
    },
  )
  return run
}
