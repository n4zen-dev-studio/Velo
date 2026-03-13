type DateInput = string | Date | null | undefined

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

export function formatDateTime(input: DateInput): string {
  if (!input) return "—"
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return "—"

  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  const day = pad2(date.getDate())
  const month = pad2(date.getMonth() + 1)
  const year = date.getFullYear()
  return `${hours}:${minutes} ${day}/${month}/${year}`
}

export function formatShortDate(input: DateInput): string {
  if (!input) return "—"
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function formatDateRange(start?: DateInput, end?: DateInput): string {
  if (start && end) {
    return `${formatShortDate(start)} - ${formatShortDate(end)}`
  }
  if (start) return `Started ${formatShortDate(start)}`
  if (end) return `Completed ${formatShortDate(end)}`
  return "No dates"
}
