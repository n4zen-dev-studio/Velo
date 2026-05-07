import { getDb } from "@/services/db/db"
import { execute, queryAll, queryFirst } from "@/services/db/queries"
import type { Project, ProjectMember } from "@/services/db/types"

export async function upsertProject(project: Project) {
  const database = await getDb()
  await execute(
    database,
    `INSERT INTO projects (
        id,
        name,
        workspaceId,
        createdByUserId,
        updatedAt,
        archivedAt
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        workspaceId = excluded.workspaceId,
        createdByUserId = excluded.createdByUserId,
        updatedAt = excluded.updatedAt,
        archivedAt = excluded.archivedAt`,
    [
      project.id,
      project.name,
      project.workspaceId,
      project.createdByUserId,
      project.updatedAt,
      project.archivedAt,
    ],
  )
}

export async function listProjects(workspaceId?: string) {
  const database = await getDb()
  if (!workspaceId) {
    return queryAll<Project>(database, "SELECT * FROM projects WHERE archivedAt IS NULL ORDER BY name")
  }
  return queryAll<Project>(
    database,
    "SELECT * FROM projects WHERE archivedAt IS NULL AND workspaceId = ? ORDER BY name",
    [workspaceId],
  )
}

export async function getProjectById(projectId: string) {
  const database = await getDb()
  return queryFirst<Project>(database, "SELECT * FROM projects WHERE id = ?", [projectId])
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
