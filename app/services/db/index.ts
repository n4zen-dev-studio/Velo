export * from "./db"
export * from "./migrations"
export * from "./schema"
export * from "./types"
export * from "./repositories/commentsRepository"
export * from "./repositories/changeLogRepository"
export * from "./repositories/projectsRepository"
export * from "./repositories/taskEventsRepository"
export * from "./repositories/statusesRepository"
export * from "./repositories/tasksRepository"

import { getDb } from "./db"
import { migrate } from "./migrations"
import { seedDefaultStatuses } from "./repositories/statusesRepository"

export async function initializeDatabase() {
  const db = await getDb()
  await seedDefaultStatuses(db)
}
