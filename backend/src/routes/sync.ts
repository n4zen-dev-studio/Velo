import type { FastifyInstance } from "fastify"

import { prisma } from "../prisma"

interface SyncOp {
  opId: string
  entityType: "task" | "comment" | "user" | "workspace_member"
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
    const failed: Array<{ opId: string; message: string }> = []

    await prisma.$transaction(async (tx) => {
      for (const op of body.ops) {
        if (!op.opId || !op.entityId || !op.entityType || !op.opType) {
          failed.push({ opId: op.opId ?? "unknown", message: "Invalid op envelope" })
          continue
        }
        const existing = await tx.opDedup.findUnique({ where: { opId: op.opId } })
        if (existing) {
          ackOpIds.push(op.opId)
          continue
        }

        if (op.entityType === "task") {
          const validation = validateTaskOp(op)
          if (!validation.ok) {
            failed.push({ opId: op.opId, message: validation.message })
            continue
          }
          await applyTaskOp(tx, userId, op)
        } else if (op.entityType === "comment") {
          const validation = validateCommentOp(op)
          if (!validation.ok) {
            failed.push({ opId: op.opId, message: validation.message })
            continue
          }
          await applyCommentOp(tx, userId, op)
        } else if (op.entityType === "user") {
          const validation = validateUserOp(op)
          if (!validation.ok) {
            failed.push({ opId: op.opId, message: validation.message })
            continue
          }
          await applyUserOp(tx, userId, op)
        } else if (op.entityType === "workspace_member") {
          const validation = validateWorkspaceMemberOp(op)
          if (!validation.ok) {
            failed.push({ opId: op.opId, message: validation.message })
            continue
          }
          await applyWorkspaceMemberOp(tx, userId, op)
        } else {
          failed.push({ opId: op.opId, message: "Unknown entityType" })
          continue
        }

        await tx.opDedup.create({ data: { opId: op.opId, userId } })
        ackOpIds.push(op.opId)
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
      failed,
      changes: changes.map((row) => ({
        entityType: row.entityType as "task" | "comment" | "user" | "workspace_member",
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
    const record = {
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
    }
    await tx.task.upsert({
      where: { id: op.entityId },
      update: record,
      create: record,
    })

    await logChange(tx, userId, "task", op.entityId, "DELETE", record, revision, now)
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
    const record = {
      id: op.entityId,
      taskId: patch.taskId ?? "",
      body: patch.body ?? "",
      createdByUserId: patch.createdByUserId ?? userId,
      createdAt: patch.createdAt ? new Date(patch.createdAt) : now,
      updatedAt: now,
      revision,
      deletedAt: now,
    }
    await tx.comment.upsert({
      where: { id: op.entityId },
      update: record,
      create: record,
    })

    await logChange(tx, userId, "comment", op.entityId, "DELETE", record, revision, now)
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

async function applyUserOp(tx: typeof prisma, userId: string, op: SyncOp) {
  const patch = op.patch as any
  const now = new Date()
  const revision = patch.revision ?? `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const record = {
    id: op.entityId,
    email: patch.email ?? null,
    username: patch.username ?? null,
    displayName: patch.displayName ?? null,
    avatarUrl: patch.avatarUrl ?? null,
    createdAt: patch.createdAt ? new Date(patch.createdAt) : now,
    updatedAt: now,
    deletedAt: op.opType === "DELETE" ? now : patch.deletedAt ? new Date(patch.deletedAt) : null,
    revision,
  }

  await tx.user.upsert({
    where: { id: op.entityId },
    update: record,
    create: {
      ...record,
      passwordHash: patch.passwordHash ?? "sync-placeholder",
      emailVerified: patch.emailVerified ?? false,
    },
  })

  await logChange(tx, userId, "user", op.entityId, op.opType, record, revision, now)
}

async function applyWorkspaceMemberOp(tx: typeof prisma, userId: string, op: SyncOp) {
  const patch = op.patch as any
  const now = new Date()
  const revision = patch.revision ?? `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  let role = patch.role ?? "MEMBER"
  if (op.opType === "UPSERT") {
    const existingOwner = await tx.workspaceMember.findFirst({
      where: { workspaceId: patch.workspaceId, role: "OWNER", deletedAt: null },
    })
    if (!existingOwner && patch.userId === userId) {
      role = "OWNER"
    }
  }

  const record = {
    id: op.entityId,
    workspaceId: patch.workspaceId,
    userId: patch.userId,
    role,
    createdAt: patch.createdAt ? new Date(patch.createdAt) : now,
    updatedAt: now,
    deletedAt: op.opType === "DELETE" ? now : patch.deletedAt ? new Date(patch.deletedAt) : null,
    revision,
  }

  await tx.workspaceMember.upsert({
    where: { id: op.entityId },
    update: record,
    create: record,
  })

  await logChange(tx, userId, "workspace_member", op.entityId, op.opType, record, revision, now)
}

async function logChange(
  tx: typeof prisma,
  userId: string,
  entityType: "task" | "comment" | "user" | "workspace_member",
  entityId: string,
  opType: "UPSERT" | "DELETE",
  payload: Record<string, unknown>,
  revision: string,
  updatedAt: Date,
) {
  const safePayload = toJsonSafe({
    ...payload,
    updatedAt: payload.updatedAt instanceof Date ? payload.updatedAt.toISOString() : payload.updatedAt,
  })
  await tx.serverChange.create({
    data: {
      userId,
      entityType,
      entityId,
      opType,
      payload: safePayload,
      revision,
      updatedAt,
    },
  })
}

function toJsonSafe(input: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(input, (_key, value) => {
      if (value instanceof Date) return value.toISOString()
      return value === undefined ? null : value
    }),
  )
}

function validateTaskOp(op: SyncOp) {
  if (op.opType === "UPSERT") {
    const patch = op.patch as any
    if (!patch.title || !patch.statusId || !patch.priority) {
      return { ok: false, message: "Task UPSERT requires title, statusId, priority" }
    }
  }
  return { ok: true, message: "" }
}

function validateCommentOp(op: SyncOp) {
  if (op.opType === "UPSERT") {
    const patch = op.patch as any
    if (!patch.taskId || !patch.body) {
      return { ok: false, message: "Comment UPSERT requires taskId and body" }
    }
  }
  return { ok: true, message: "" }
}

function validateUserOp(_op: SyncOp) {
  return { ok: true, message: "" }
}

function validateWorkspaceMemberOp(op: SyncOp) {
  if (op.opType === "UPSERT") {
    const patch = op.patch as any
    if (!patch.workspaceId || !patch.userId) {
      return { ok: false, message: "WorkspaceMember UPSERT requires workspaceId and userId" }
    }
  }
  return { ok: true, message: "" }
}
