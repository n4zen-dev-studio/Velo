import { getDb } from "@/services/db/db"
import { execute, queryAll, queryFirst } from "@/services/db/queries"
import type { Project, ProjectMember } from "@/services/db/types"
import { getActiveScopeKey } from "@/services/session/scope"
import { listAllDataScopeKeys, resolveWorkspaceScopeKey } from "@/services/db/scopeKey"

export async function upsertProject(project: Project, scopeKey?: string) {
  const database = await getDb()
  const resolvedScope =
    project.scopeKey ?? scopeKey ?? (await resolveWorkspaceScopeKey(project.workspaceId, undefined, database))
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
  if (!workspaceId) {
    const scopes = await listAllDataScopeKeys(scopeKey, database)
    const placeholders = scopes.map(() => "?").join(", ")
    return queryAll<Project>(
      database,
      `SELECT * FROM projects WHERE scopeKey IN (${placeholders}) AND archivedAt IS NULL ORDER BY name`,
      scopes,
    )
  }
  const resolvedScope = await resolveWorkspaceScopeKey(workspaceId, scopeKey, database)
  return queryAll<Project>(
    database,
    "SELECT * FROM projects WHERE scopeKey = ? AND archivedAt IS NULL AND workspaceId = ? ORDER BY name",
    [resolvedScope, workspaceId],
  )
}

export async function getProjectById(projectId: string, scopeKey?: string) {
  const database = await getDb()
  const scopes = await listAllDataScopeKeys(scopeKey, database)
  const placeholders = scopes.map(() => "?").join(", ")
  return queryFirst<Project>(
    database,
    `SELECT * FROM projects WHERE id = ? AND scopeKey IN (${placeholders})`,
    [projectId, ...scopes],
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
