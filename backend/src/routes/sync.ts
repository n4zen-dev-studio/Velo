import type { FastifyInstance } from "fastify"
import crypto from "node:crypto"

import { prisma } from "../prisma.js"

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
    if (!body.deviceId) {
      return reply.code(400).send({ error: "deviceId required" })
    }

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
          const validation = await validateTaskOp(tx, userId, op)
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

    const deviceState = await prisma.syncDeviceState.findUnique({
      where: { userId_deviceId: { userId, deviceId: body.deviceId } },
    })
    const cursorValue = deviceState?.lastCursor ?? BigInt(0)
    const changes = await prisma.serverChange.findMany({
      where: { userId, id: { gt: cursorValue } },
      orderBy: { id: "asc" },
      take: 500,
    })

    const newCursorValue = changes.length > 0 ? changes[changes.length - 1].id : cursorValue
    await prisma.syncDeviceState.upsert({
      where: { userId_deviceId: { userId, deviceId: body.deviceId } },
      update: { lastCursor: newCursorValue },
      create: { userId, deviceId: body.deviceId, lastCursor: newCursorValue },
    })

    const mapped = changes.map((row) => ({
      entityType: row.entityType as
        | "task"
        | "comment"
        | "task_events"
        | "user"
        | "workspace_member"
        | "workspace",
      entityId: row.entityId,
      opType: row.opType as "UPSERT" | "DELETE",
      payload: row.payload as Record<string, unknown>,
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString(),
    }))
    if (process.env.NODE_ENV !== "production") {
      for (const change of mapped) {
        if (change.entityType === "task") {
          const payload = change.payload as any
          console.log("[sync] send task workspaceId", {
            taskId: change.entityId,
            workspaceId: payload?.workspaceId ?? null,
          })
        }
      }
    }
    return reply.send({
      newCursor: String(newCursorValue),
      ackOpIds,
      failed,
      changes: mapped,
    })
  })
}

async function applyTaskOp(tx: typeof prisma, userId: string, op: SyncOp) {
  const patch = op.patch as any
  const now = new Date()
  const revision = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const existing = await tx.task.findUnique({ where: { id: op.entityId } })
  let assigneeUserId = patch.assigneeUserId
  if (assigneeUserId === undefined) {
    assigneeUserId = existing?.assigneeUserId ?? userId
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[sync] task op workspaceId", {
      opId: op.opId,
      taskId: op.entityId,
      workspaceId: patch.workspaceId ?? null,
    })
  }

  if (op.opType === "DELETE") {
    const record = {
      id: op.entityId,
      projectId: patch.projectId ?? null,
      workspaceId: patch.workspaceId,
      title: patch.title ?? "",
      description: patch.description ?? "",
      statusId: patch.statusId ?? "todo",
      priority: patch.priority ?? "medium",
      assigneeUserId: assigneeUserId ?? null,
      createdByUserId: patch.createdByUserId ?? userId,
      startDate: patch.startDate ? new Date(patch.startDate) : (existing?.startDate ?? null),
      endDate: patch.endDate ? new Date(patch.endDate) : (existing?.endDate ?? null),
      updatedAt: now,
      revision,
      deletedAt: now,
    }
    await tx.task.upsert({
      where: { id: op.entityId },
      update: record,
      create: record,
    })

    await createTaskEventForOp(tx, {
      taskId: record.id,
      workspaceId: record.workspaceId,
      actorUserId: userId,
      now,
      existingTask: existing,
      nextStatusId: record.statusId,
      opType: "DELETE",
      taskRevision: record.revision,
    })
    await logChangeForWorkspace(
      tx,
      userId,
      record.workspaceId,
      "task",
      op.entityId,
      "DELETE",
      record,
      revision,
      now,
    )
    return
  }

  const record = {
    id: op.entityId,
    projectId: patch.projectId ?? null,
    workspaceId: patch.workspaceId ?? null,
    title: patch.title,
    description: patch.description,
    statusId: patch.statusId,
    priority: patch.priority,
    assigneeUserId: assigneeUserId ?? null,
    createdByUserId: patch.createdByUserId ?? userId,
    startDate: patch.startDate ? new Date(patch.startDate) : (existing?.startDate ?? null),
    endDate: patch.endDate ? new Date(patch.endDate) : (existing?.endDate ?? null),
    updatedAt: now,
    revision,
    deletedAt: patch.deletedAt ?? null,
  }

  await tx.task.upsert({
    where: { id: op.entityId },
    update: record,
    create: record,
  })

  await createTaskEventForOp(tx, {
    taskId: record.id,
    workspaceId: record.workspaceId,
    actorUserId: userId,
    now,
    existingTask: existing,
    nextStatusId: record.statusId,
    opType: "UPSERT",
    taskRevision: record.revision,
  })
  await logChangeForWorkspace(
    tx,
    userId,
    record.workspaceId,
    "task",
    op.entityId,
    "UPSERT",
    record,
    revision,
    now,
  )
}

async function createTaskEventForOp(
  tx: typeof prisma,
  params: {
    taskId: string
    workspaceId: string | null | undefined
    actorUserId: string
    now: Date
    existingTask: { statusId: string } | null
    nextStatusId: string | undefined
    opType: "UPSERT" | "DELETE"
    taskRevision: string
  },
) {
  const {
    taskId,
    workspaceId,
    actorUserId,
    now,
    existingTask,
    nextStatusId,
    opType,
    taskRevision,
  } = params
  const eventId = crypto.randomUUID()
  const eventRevision = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  let type = "TASK_UPDATED"
  let payload: Record<string, unknown> = { message: "Task updated" }
  if (opType === "DELETE") {
    type = "TASK_DELETED"
    payload = { message: "Task deleted" }
  } else if (!existingTask) {
    type = "TASK_CREATED"
    payload = { message: "Task created" }
  } else if (existingTask.statusId !== nextStatusId) {
    type = "STATUS_CHANGED"
    payload = {
      fromStatusId: existingTask.statusId,
      toStatusId: nextStatusId,
      revision: taskRevision,
    }
  }

  const scopeKey = workspaceId ? `workspace:${workspaceId}` : ""
  const record = {
    id: eventId,
    taskId,
    type,
    payload: JSON.stringify(payload),
    createdAt: now,
    createdByUserId: actorUserId,
    scopeKey,
    revision: eventRevision,
    deletedAt: null,
  }

  await tx.taskEvent.create({ data: record })

  await logChangeForWorkspace(
    tx,
    actorUserId,
    workspaceId,
    "task_events",
    eventId,
    "UPSERT",
    {
      id: eventId,
      taskId,
      type,
      payload: record.payload,
      createdAt: now.toISOString(),
      createdByUserId: actorUserId,
      scopeKey,
    },
    eventRevision,
    now,
  )

  // Verification: sync another workspace member and confirm the task activity timeline includes this event.
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

    const workspaceId = await resolveWorkspaceIdForTask(tx, record.taskId)
    await logChangeForWorkspace(
      tx,
      userId,
      workspaceId,
      "comment",
      op.entityId,
      "DELETE",
      record,
      revision,
      now,
    )
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

  const workspaceId = await resolveWorkspaceIdForTask(tx, record.taskId)
  await logChangeForWorkspace(
    tx,
    userId,
    workspaceId,
    "comment",
    op.entityId,
    "UPSERT",
    record,
    revision,
    now,
  )
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

  const existingActiveMember = await tx.workspaceMember.findFirst({
    where: { workspaceId: patch.workspaceId, userId: patch.userId, deletedAt: null },
  })

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

  const recipientIds = new Set<string>([userId, record.userId])
  await logChangeForRecipients(
    tx,
    Array.from(recipientIds),
    "workspace_member",
    op.entityId,
    op.opType,
    record,
    revision,
    now,
  )

  await emitWorkspaceIndexChangeForRecipients(
    tx,
    record.workspaceId,
    Array.from(recipientIds),
    now,
    patch.workspaceLabel as string | undefined,
  )

  if (op.opType === "UPSERT" && !record.deletedAt && !existingActiveMember) {
    const tasks = await tx.task.findMany({
      where: { workspaceId: record.workspaceId, deletedAt: null },
    })
    for (const task of tasks) {
      await logChangeForRecipients(
        tx,
        [record.userId],
        "task",
        task.id,
        "UPSERT",
        {
          id: task.id,
          projectId: task.projectId ?? null,
          workspaceId: task.workspaceId,
          title: task.title,
          description: task.description,
          statusId: task.statusId,
          priority: task.priority,
          assigneeUserId: task.assigneeUserId ?? null,
          createdByUserId: task.createdByUserId,
          startDate: task.startDate ? task.startDate.toISOString() : null,
          endDate: task.endDate ? task.endDate.toISOString() : null,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          revision: task.revision,
          deletedAt: task.deletedAt,
        },
        task.revision ?? `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        now,
      )
    }
  }
}

async function logChange(
  tx: typeof prisma,
  userId: string,
  entityType: "task" | "comment" | "task_events" | "user" | "workspace_member" | "workspace",
  entityId: string,
  opType: "UPSERT" | "DELETE",
  payload: Record<string, unknown>,
  revision: string,
  updatedAt: Date,
) {
  const safePayload = toJsonSafe({
    ...payload,
    updatedAt:
      payload.updatedAt instanceof Date ? payload.updatedAt.toISOString() : payload.updatedAt,
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

async function resolveWorkspaceIdForTask(tx: typeof prisma, taskId: string) {
  const task = await tx.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } })
  return task?.workspaceId ?? null
}

async function listWorkspaceRecipientUserIds(tx: typeof prisma, workspaceId: string) {
  const rows = await tx.workspaceMember.findMany({
    where: { workspaceId, deletedAt: null },
    select: { userId: true },
  })
  const unique = new Set(rows.map((row) => row.userId))
  return Array.from(unique)
}

async function logChangeForWorkspace(
  tx: typeof prisma,
  actorUserId: string,
  workspaceId: string | null | undefined,
  entityType: "task" | "comment" | "task_events" | "user" | "workspace_member" | "workspace",
  entityId: string,
  opType: "UPSERT" | "DELETE",
  payload: Record<string, unknown>,
  revision: string,
  updatedAt: Date,
) {
  if (!workspaceId) {
    await logChange(tx, actorUserId, entityType, entityId, opType, payload, revision, updatedAt)
    return
  }
  const recipients = await listWorkspaceRecipientUserIds(tx, workspaceId)
  if (recipients.length === 0) {
    await logChange(tx, actorUserId, entityType, entityId, opType, payload, revision, updatedAt)
    return
  }
  await logChangeForRecipients(
    tx,
    recipients,
    entityType,
    entityId,
    opType,
    payload,
    revision,
    updatedAt,
  )
}

async function logChangeForRecipients(
  tx: typeof prisma,
  userIds: string[],
  entityType: "task" | "comment" | "task_events" | "user" | "workspace_member" | "workspace",
  entityId: string,
  opType: "UPSERT" | "DELETE",
  payload: Record<string, unknown>,
  revision: string,
  updatedAt: Date,
) {
  const recipients = Array.from(new Set(userIds))
  const safePayload = toJsonSafe({
    ...payload,
    updatedAt:
      payload.updatedAt instanceof Date ? payload.updatedAt.toISOString() : payload.updatedAt,
  })
  await tx.serverChange.createMany({
    data: recipients.map((recipientId) => ({
      userId: recipientId,
      entityType,
      entityId,
      opType,
      payload: safePayload,
      revision,
      updatedAt,
    })),
  })
}

async function emitWorkspaceIndexChangeForRecipients(
  tx: typeof prisma,
  workspaceId: string,
  recipientUserIds: string[],
  now: Date,
  workspaceLabel?: string,
) {
  let workspace = await tx.workspace.findUnique({ where: { id: workspaceId } })

  if (!workspace) {
    if (!workspaceLabel) {
      console.warn("[workspace] Missing workspace row + label; cannot emit correct index", {
        workspaceId,
      })
      return
    }
    // Create with correct label instead of workspaceId
    workspace = await tx.workspace.create({
      data: { id: workspaceId, label: workspaceLabel, kind: "custom" },
    })
  } else if (workspaceLabel && workspace.label !== workspaceLabel) {
    workspace = await tx.workspace.update({
      where: { id: workspaceId },
      data: { label: workspaceLabel },
    })
  }

  const payload = {
    id: workspace.id,
    label: workspace.label,
    kind: workspace.kind,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    remoteId: null,
  }

  const revision = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await logChangeForRecipients(
    tx,
    recipientUserIds,
    "workspace",
    workspace.id,
    "UPSERT",
    payload,
    revision,
    now,
  )
}

async function validateTaskOp(tx: typeof prisma, userId: string, op: SyncOp) {
  const patch = op.patch as any
  if (op.opType === "UPSERT") {
    if (!patch.title || !patch.statusId || !patch.priority) {
      return { ok: false, message: "Task UPSERT requires title, statusId, priority" }
    }
  }
  if (patch.workspaceId) {
    const member = await tx.workspaceMember.findFirst({
      where: { workspaceId: patch.workspaceId, userId, deletedAt: null },
    })
    if (!member) {
      return { ok: false, message: "User is not a member of workspace" }
    }

    if (patch.assigneeUserId) {
      const assigneeMember = await tx.workspaceMember.findFirst({
        where: { workspaceId: patch.workspaceId, userId: patch.assigneeUserId, deletedAt: null },
      })
      if (!assigneeMember) {
        return { ok: false, message: "Assignee is not a member of workspace" }
      }
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
