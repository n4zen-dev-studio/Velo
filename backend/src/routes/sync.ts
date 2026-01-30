import type { FastifyInstance } from "fastify"

import { query } from "../db"

interface SyncOp {
  opId: string
  entityType: "task" | "comment"
  entityId: string
  opType: "UPSERT" | "DELETE"
  patch: Record<string, unknown>
  baseRevision: string
  createdAt: string
  projectId: string | null
}

interface SyncRequest {
  cursor: string | null
  deviceId: string
  userId: string
  ops: SyncOp[]
}

export async function syncRoutes(app: FastifyInstance) {
  app.post("/sync", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const body = request.body as SyncRequest

    const ackOpIds: string[] = []

    await query("BEGIN")
    try {
      for (const op of body.ops) {
        ackOpIds.push(op.opId)
        const existing = await query<{ opid: string }>(
          "SELECT opid FROM op_dedup WHERE opid = $1",
          [op.opId],
        )
        if (existing.rows.length > 0) continue

        if (op.entityType === "task") {
          await applyTaskOp(userId, op)
        }
        if (op.entityType === "comment") {
          await applyCommentOp(userId, op)
        }

        await query(
          "INSERT INTO op_dedup (opid, user_id) VALUES ($1, $2)",
          [op.opId, userId],
        )
      }

      const cursorValue = body.cursor ? Number(body.cursor) : 0
      const changeRows = await query<{
        id: number
        entitytype: "task" | "comment"
        entityid: string
        optype: "UPSERT" | "DELETE"
        payload: Record<string, unknown>
        revision: string
        updatedat: string
      }>(
        `SELECT id, entitytype, entityid, optype, payload, revision, updatedat
         FROM server_changes
         WHERE id > $1
         ORDER BY id ASC
         LIMIT 500`,
        [cursorValue],
      )

      const newCursor =
        changeRows.rows.length > 0
          ? String(changeRows.rows[changeRows.rows.length - 1].id)
          : String(cursorValue)

      await query("COMMIT")

      return reply.send({
        newCursor,
        ackOpIds,
        changes: changeRows.rows.map((row) => ({
          entityType: row.entitytype,
          entityId: row.entityid,
          opType: row.optype,
          payload: row.payload,
          revision: row.revision,
          updatedAt: row.updatedat,
        })),
        conflicts: [],
      })
    } catch (error) {
      await query("ROLLBACK")
      throw error
    }
  })
}

async function applyTaskOp(userId: string, op: SyncOp) {
  const patch = op.patch as any
  if (op.opType === "DELETE") {
    const updatedAt = patch.updatedAt ?? new Date().toISOString()
    const revision = `srv-${Date.now()}`
    await query(
      `UPDATE tasks
       SET deletedat = $1, updatedat = $2, revision = $3
       WHERE id = $4`,
      [updatedAt, updatedAt, revision, op.entityId],
    )
    await logChange("task", op.entityId, "DELETE", patch, revision, updatedAt)
    return
  }

  const updatedAt = patch.updatedAt ?? new Date().toISOString()
  const revision = `srv-${Date.now()}`
  await query(
    `INSERT INTO tasks (
        id, projectid, title, description, statusid, priority,
        assigneeuserid, createdbyuserid, updatedat, revision, deletedat
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(id) DO UPDATE SET
        projectid = excluded.projectid,
        title = excluded.title,
        description = excluded.description,
        statusid = excluded.statusid,
        priority = excluded.priority,
        assigneeuserid = excluded.assigneeuserid,
        createdbyuserid = excluded.createdbyuserid,
        updatedat = excluded.updatedat,
        revision = excluded.revision,
        deletedat = excluded.deletedat`,
    [
      op.entityId,
      patch.projectId ?? null,
      patch.title,
      patch.description,
      patch.statusId,
      patch.priority,
      patch.assigneeUserId ?? null,
      patch.createdByUserId ?? userId,
      updatedAt,
      revision,
      patch.deletedAt ?? null,
    ],
  )

  await logChange("task", op.entityId, "UPSERT", patch, revision, updatedAt)
}

async function applyCommentOp(userId: string, op: SyncOp) {
  const patch = op.patch as any
  if (op.opType === "DELETE") {
    const updatedAt = patch.updatedAt ?? new Date().toISOString()
    const revision = `srv-${Date.now()}`
    await query(
      `UPDATE comments
       SET deletedat = $1, updatedat = $2, revision = $3
       WHERE id = $4`,
      [updatedAt, updatedAt, revision, op.entityId],
    )
    await logChange("comment", op.entityId, "DELETE", patch, revision, updatedAt)
    return
  }

  const updatedAt = patch.updatedAt ?? new Date().toISOString()
  const revision = `srv-${Date.now()}`
  await query(
    `INSERT INTO comments (
        id, taskid, body, createdbyuserid, createdat, updatedat, revision, deletedat
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(id) DO UPDATE SET
        taskid = excluded.taskid,
        body = excluded.body,
        createdbyuserid = excluded.createdbyuserid,
        createdat = excluded.createdat,
        updatedat = excluded.updatedat,
        revision = excluded.revision,
        deletedat = excluded.deletedat`,
    [
      op.entityId,
      patch.taskId,
      patch.body,
      patch.createdByUserId ?? userId,
      patch.createdAt ?? updatedAt,
      updatedAt,
      revision,
      patch.deletedAt ?? null,
    ],
  )

  await logChange("comment", op.entityId, "UPSERT", patch, revision, updatedAt)
}

async function logChange(
  entityType: "task" | "comment",
  entityId: string,
  opType: "UPSERT" | "DELETE",
  payload: Record<string, unknown>,
  revision: string,
  updatedAt: string,
) {
  await query(
    `INSERT INTO server_changes (entitytype, entityid, optype, payload, revision, updatedat)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [entityType, entityId, opType, payload, revision, updatedAt],
  )
}
