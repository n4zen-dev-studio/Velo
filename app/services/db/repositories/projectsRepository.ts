import { getDb } from "@/services/db/db"
import { execute, queryAll, queryFirst } from "@/services/db/queries"
import type { Project, ProjectMember } from "@/services/db/types"
import { getActiveScopeKey } from "@/services/session/scope"

export async function upsertProject(project: Project, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = project.scopeKey ?? scopeKey ?? (await getActiveScopeKey())
  await execute(
    database,
    `INSERT INTO projects (
        id,
        name,
        workspaceId,
        createdByUserId,
        updatedAt,
        archivedAt,
        scopeKey
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        workspaceId = excluded.workspaceId,
        createdByUserId = excluded.createdByUserId,
        updatedAt = excluded.updatedAt,
        archivedAt = excluded.archivedAt,
        scopeKey = excluded.scopeKey`,
    [
      project.id,
      project.name,
      project.workspaceId,
      project.createdByUserId,
      project.updatedAt,
      project.archivedAt,
      resolvedScope,
    ],
  )
}

export async function listProjects(workspaceId?: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  if (!workspaceId) {
    return queryAll<Project>(
      database,
      "SELECT * FROM projects WHERE scopeKey = ? AND archivedAt IS NULL ORDER BY name",
      [resolvedScope],
    )
  }
  return queryAll<Project>(
    database,
    "SELECT * FROM projects WHERE scopeKey = ? AND archivedAt IS NULL AND workspaceId = ? ORDER BY name",
    [resolvedScope, workspaceId],
  )
}

export async function getProjectById(projectId: string, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = scopeKey ?? (await getActiveScopeKey())
  return queryFirst<Project>(
    database,
    "SELECT * FROM projects WHERE id = ? AND scopeKey = ?",
    [projectId, resolvedScope],
  )
}

export async function upsertProjectMember(member: ProjectMember, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope = member.scopeKey ?? scopeKey ?? (await getActiveScopeKey())
  await execute(
    database,
    `INSERT INTO project_members (
        projectId,
        userId,
        role,
        joinedAt,
        scopeKey
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(projectId, userId) DO UPDATE SET
        role = excluded.role,
        joinedAt = excluded.joinedAt,
        scopeKey = excluded.scopeKey`,
    [member.projectId, member.userId, member.role, member.joinedAt, resolvedScope],
  )
}
