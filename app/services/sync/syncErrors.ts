export function normalizeSyncError(error: unknown) {
  if (typeof error === "string") return error
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes("network")) return "Network unavailable"
    if (message.includes("timeout")) return "Network timeout"
    if (message.includes("401") || message.includes("unauthorized")) return "Authentication expired"
    return error.message
  }
  return "Unknown sync error"
}
