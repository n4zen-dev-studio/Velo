const isDev = __DEV__

type LogFn = (message: string, context?: Record<string, unknown>) => void

function logFactory(prefix: string): LogFn {
  return (message, context) => {
    if (!isDev) return
    if (context) {
      console.log(`[${prefix}] ${message}`, context)
    } else {
      console.log(`[${prefix}] ${message}`)
    }
  }
}

export const logSync = logFactory("SYNC")
export const logDB = logFactory("DB")
export const logConflict = logFactory("CONFLICT")
