import type { FastifyInstance } from "fastify"

import { prisma } from "../prisma"

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
  ops: SyncOp[]
}

export async function syncRoutes(app: FastifyInstance) {
  app.post("/sync", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const body = request.body as SyncRequest

    const ackOpIds: string[] = []

    await prisma.$transaction(async (tx) => {
      for (const op of body.ops) {
        ackOpIds.push(op.opId)
        const existing = await tx.opDedup.findUnique({ where: { opId: op.opId } })
        if (existing) continue

        if (op.entityType === "task") {
          await applyTaskOp(tx, userId, op)
        }
        if (op.entityType === "comment") {
          await applyCommentOp(tx, userId, op)
        }

        await tx.opDedup.create({ data: { opId: op.opId, userId } })
      }
    })

    const cursorValue = body.cursor ? BigInt(body.cursor) : BigInt(0)
    const changes = await prisma.serverChange.findMany({
      where: { userId, id: { gt: cursorValue } },
      orderBy: { id: "asc" },
      take: 500,
    })

    const newCursor = changes.length > 0 ? String(changes[changes.length - 1].id) : body.cursor

    return reply.send({
      newCursor,
      ackOpIds,
      changes: changes.map((row) => ({
        entityType: row.entityType as "task" | "comment",
        entityId: row.entityId,
        opType: row.opType as "UPSERT" | "DELETE",
        payload: row.payload as Record<string, unknown>,
        revision: row.revision,
        updatedAt: row.updatedAt.toISOString(),
      })),
    })
  })
}

async function applyTaskOp(tx: typeof prisma, userId: string, op: SyncOp) {
  const patch = op.patch as any
  const now = new Date()
  const revision = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (op.opType === "DELETE") {
    await tx.task.update({
      where: { id: op.entityId },
      data: { deletedAt: now, updatedAt: now, revision },
    }).catch(async () => {
      await tx.task.create({
        data: {
          id: op.entityId,
          projectId: patch.projectId ?? null,
          title: patch.title ?? "",
          description: patch.description ?? "",
          statusId: patch.statusId ?? "todo",
          priority: patch.priority ?? "medium",
          assigneeUserId: patch.assigneeUserId ?? null,
          createdByUserId: patch.createdByUserId ?? userId,
          updatedAt: now,
          revision,
          deletedAt: now,
        },
      })
    })

    await logChange(tx, userId, "task", op.entityId, "DELETE", patch, revision, now)
    return
  }

  const record = {
    id: op.entityId,
    projectId: patch.projectId ?? null,
    title: patch.title,
    description: patch.description,
    statusId: patch.statusId,
    priority: patch.priority,
    assigneeUserId: patch.assigneeUserId ?? null,
    createdByUserId: patch.createdByUserId ?? userId,
    updatedAt: now,
    revision,
    deletedAt: patch.deletedAt ?? null,
  }

  await tx.task.upsert({
    where: { id: op.entityId },
    update: record,
    create: record,
  })

  await logChange(tx, userId, "task", op.entityId, "UPSERT", record, revision, now)
}

async function applyCommentOp(tx: typeof prisma, userId: string, op: SyncOp) {
  const patch = op.patch as any
  const now = new Date()
  const revision = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (op.opType === "DELETE") {
    await tx.comment.update({
      where: { id: op.entityId },
      data: { deletedAt: now, updatedAt: now, revision },
    }).catch(async () => {
      await tx.comment.create({
        data: {
          id: op.entityId,
          taskId: patch.taskId,
          body: patch.body ?? "",
          createdByUserId: patch.createdByUserId ?? userId,
          createdAt: patch.createdAt ? new Date(patch.createdAt) : now,
          updatedAt: now,
          revision,
          deletedAt: now,
        },
      })
    })

    await logChange(tx, userId, "comment", op.entityId, "DELETE", patch, revision, now)
    return
  }

  const record = {
    id: op.entityId,
    taskId: patch.taskId,
    body: patch.body,
    createdByUserId: patch.createdByUserId ?? userId,
    createdAt: patch.createdAt ? new Date(patch.createdAt) : now,
    updatedAt: now,
    revision,
    deletedAt: patch.deletedAt ?? null,
  }

  await tx.comment.upsert({
    where: { id: op.entityId },
    update: record,
    create: record,
  })

  await logChange(tx, userId, "comment", op.entityId, "UPSERT", record, revision, now)
}

async function logChange(
  tx: typeof prisma,
  userId: string,
  entityType: "task" | "comment",
  entityId: string,
  opType: "UPSERT" | "DELETE",
  payload: Record<string, unknown>,
  revision: string,
  updatedAt: Date,
) {
  await tx.serverChange.create({
    data: {
      userId,
      entityType,
      entityId,
      opType,
      payload,
      revision,
      updatedAt,
    },
  })
}
