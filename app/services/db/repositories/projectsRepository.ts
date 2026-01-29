import { getDb } from "@/services/db/db"
import { execute, queryAll } from "@/services/db/queries"
import type { Project, ProjectMember } from "@/services/db/types"

export async function upsertProject(project: Project) {
  const database = await getDb()
  await execute(
    database,
    `INSERT INTO projects (
        id,
        name,
        createdByUserId,
        updatedAt,
        archivedAt
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        createdByUserId = excluded.createdByUserId,
        updatedAt = excluded.updatedAt,
        archivedAt = excluded.archivedAt`,
    [project.id, project.name, project.createdByUserId, project.updatedAt, project.archivedAt],
  )
}

export async function listProjects() {
  const database = await getDb()
  return queryAll<Project>(database, "SELECT * FROM projects WHERE archivedAt IS NULL ORDER BY name")
}

export async function upsertProjectMember(member: ProjectMember) {
  const database = await getDb()
  await execute(
    database,
    `INSERT INTO project_members (
        projectId,
        userId,
        role,
        joinedAt
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(projectId, userId) DO UPDATE SET
        role = excluded.role,
        joinedAt = excluded.joinedAt`,
    [member.projectId, member.userId, member.role, member.joinedAt],
  )
}
