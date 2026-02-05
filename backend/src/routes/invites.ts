import type { FastifyInstance } from "fastify"
import crypto from "node:crypto"

import { prisma } from "../prisma"

function sendError(reply: any, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } })
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

function buildInviteLink(token: string) {
  const webBase = process.env.INVITE_WEB_URL ?? "https://tasktrak.app"
  return {
    web: `${webBase}/invite/${token}`,
    deepLink: `tasktrak://invite?token=${token}`,
  }
}

async function requireWorkspaceOwner(userId: string, workspaceId: string) {
  const owner = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      role: "OWNER",
      deletedAt: null,
    },
  })
  return Boolean(owner)
}

export async function inviteRoutes(app: FastifyInstance) {
  app.post(
    "/workspaces/:workspaceId/invites",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { workspaceId } = request.params as { workspaceId: string }
        const { email, workspaceLabel } = request.body as { email: string; workspaceLabel?: string }
        const inviterId = (request.user as { sub: string }).sub

        const normalized = normalizeEmail(email ?? "")
        if (!isValidEmail(normalized)) {
          return sendError(reply, 400, "INVALID_EMAIL", "Please enter a valid email address.")
        }

        const workspaceExists = await prisma.workspaceMember.findFirst({
          where: { workspaceId, deletedAt: null },
        })
        if (!workspaceExists) {
          return sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace not found.")
        }

        const isOwner = await requireWorkspaceOwner(inviterId, workspaceId)
        if (!isOwner) {
          return sendError(reply, 403, "NOT_WORKSPACE_OWNER", "Only workspace owners can invite members.")
        }

        const existingUser = await prisma.user.findUnique({
          where: { email: normalized },
          select: { id: true },
        })
        if (existingUser) {
          const existingMember = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId: existingUser.id, deletedAt: null },
          })
          if (existingMember) {
            return sendError(reply, 409, "ALREADY_MEMBER", "This user is already a member of the workspace.")
          }
        }

        const existingInvite = await prisma.workspaceInvite.findFirst({
          where: {
            workspaceId,
            email: normalized,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        })
        if (existingInvite) {
          return sendError(reply, 409, "INVITE_ALREADY_SENT", "An invite has already been sent to this email.")
        }

        const token = generateToken()
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        const invite = await prisma.workspaceInvite.create({
          data: {
            id: crypto.randomUUID(),
            workspaceId,
            workspaceLabel: workspaceLabel ?? workspaceId,
            email: normalized,
            token,
            role: "MEMBER",
            invitedById: inviterId,
            status: "PENDING",
            expiresAt,
          },
        })

        const links = buildInviteLink(invite.token)
        // eslint-disable-next-line no-console
        console.log(`[invite] Send invite to ${invite.email}: ${links.web} (deep: ${links.deepLink})`)

        return reply.send({ ok: true })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[invite] create failed", error)
        return sendError(reply, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.")
      }
    },
  )

  app.get(
    "/workspaces/:workspaceId/invites",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string }
      const userId = (request.user as { sub: string }).sub

      const workspaceExists = await prisma.workspaceMember.findFirst({
        where: { workspaceId, deletedAt: null },
      })
      if (!workspaceExists) {
        return sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace not found.")
      }

      const isOwner = await requireWorkspaceOwner(userId, workspaceId)
      if (!isOwner) {
        return sendError(reply, 403, "NOT_WORKSPACE_OWNER", "Only workspace owners can view invites.")
      }

      const invites = await prisma.workspaceInvite.findMany({
        where: {
          workspaceId,
        },
        orderBy: { createdAt: "desc" },
      })

      return reply.send(
        invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
          invitedById: invite.invitedById,
          acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
        })),
      )
    },
  )

  app.post(
    "/workspaces/:workspaceId/invites/:inviteId/revoke",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { workspaceId, inviteId } = request.params as { workspaceId: string; inviteId: string }
      const userId = (request.user as { sub: string }).sub

      const workspaceExists = await prisma.workspaceMember.findFirst({
        where: { workspaceId, deletedAt: null },
      })
      if (!workspaceExists) {
        return sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace not found.")
      }

      const isOwner = await requireWorkspaceOwner(userId, workspaceId)
      if (!isOwner) {
        return sendError(reply, 403, "NOT_WORKSPACE_OWNER", "Only workspace owners can revoke invites.")
      }

      const invite = await prisma.workspaceInvite.findFirst({
        where: { id: inviteId, workspaceId },
      })
      if (!invite) {
        return sendError(reply, 404, "INVITE_NOT_FOUND", "Invite not found.")
      }
      if (invite.status === "REVOKED") {
        return reply.send({ ok: true })
      }

      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: "REVOKED", updatedAt: new Date() },
      })

      return reply.send({ ok: true })
    },
  )

  app.delete(
    "/workspaces/:workspaceId/members/:userId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { workspaceId, userId } = request.params as { workspaceId: string; userId: string }
      const requesterId = (request.user as { sub: string }).sub

      const workspaceExists = await prisma.workspaceMember.findFirst({
        where: { workspaceId, deletedAt: null },
      })
      if (!workspaceExists) {
        return sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace not found.")
      }

      const isOwner = await requireWorkspaceOwner(requesterId, workspaceId)
      if (!isOwner) {
        return sendError(reply, 403, "NOT_WORKSPACE_OWNER", "Only workspace owners can remove members.")
      }

      if (userId === requesterId) {
        return sendError(reply, 409, "CANNOT_REMOVE_SELF", "You cannot remove yourself.")
      }

      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId, deletedAt: null },
      })
      if (!membership) {
        return sendError(reply, 404, "MEMBER_NOT_FOUND", "Member not found.")
      }

      if (membership.role === "OWNER") {
        const ownerCount = await prisma.workspaceMember.count({
          where: { workspaceId, role: "OWNER", deletedAt: null },
        })
        if (ownerCount <= 1) {
          return sendError(reply, 409, "LAST_OWNER", "You must keep at least one owner.")
        }
      }

      await prisma.workspaceMember.update({
        where: { id: membership.id },
        data: {
          deletedAt: new Date(),
          updatedAt: new Date(),
          revision: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      })

      return reply.send({ ok: true })
    },
  )

  app.delete(
    "/workspaces/:workspaceId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string }
      const userId = (request.user as { sub: string }).sub

      if (workspaceId === "personal") {
        return sendError(reply, 400, "CANNOT_DELETE_PERSONAL", "Personal workspace cannot be deleted.")
      }

      const workspaceExists = await prisma.workspaceMember.findFirst({
        where: { workspaceId, deletedAt: null },
      })
      if (!workspaceExists) {
        return sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace not found.")
      }

      const isOwner = await requireWorkspaceOwner(userId, workspaceId)
      if (!isOwner) {
        return sendError(reply, 403, "NOT_WORKSPACE_OWNER", "Only workspace owners can delete workspaces.")
      }

      const now = new Date()
      await prisma.$transaction(async (tx) => {
        await tx.workspaceMember.updateMany({
          where: { workspaceId, deletedAt: null },
          data: {
            deletedAt: now,
            updatedAt: now,
            revision: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          },
        })

        await tx.workspaceInvite.updateMany({
          where: { workspaceId, status: "PENDING" },
          data: { status: "REVOKED", updatedAt: now },
        })
      })

      return reply.send({ ok: true })
    },
  )

  app.get("/invites/:token", async (request, reply) => {
    const { token } = request.params as { token: string }
    const invite = await prisma.workspaceInvite.findUnique({ where: { token } })
    if (!invite) return reply.code(404).send({ error: "Invite not found" })

    return reply.send({
      workspace: { id: invite.workspaceId, label: invite.workspaceLabel },
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
    })
  })

  app.post(
    "/invites/:token/accept",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { token } = request.params as { token: string }
      const userId = (request.user as { sub: string }).sub

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user?.email) {
        return reply.code(400).send({ error: "User email required to accept invite" })
      }

      const invite = await prisma.workspaceInvite.findUnique({ where: { token } })
      if (!invite) return reply.code(404).send({ error: "Invite not found" })

      if (invite.status !== "PENDING") {
        const membership = await prisma.workspaceMember.findFirst({
          where: { workspaceId: invite.workspaceId, userId, deletedAt: null },
        })
        return reply.send({
          ok: true,
          workspace: { id: invite.workspaceId, label: invite.workspaceLabel, kind: "custom" },
          membership: membership
            ? {
                id: membership.id,
                workspaceId: membership.workspaceId,
                userId: membership.userId,
                role: membership.role,
                createdAt: membership.createdAt.toISOString(),
                updatedAt: membership.updatedAt.toISOString(),
                revision: membership.revision,
                deletedAt: membership.deletedAt,
              }
            : null,
          invite: {
            id: invite.id,
            status: invite.status,
            acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          },
        })
      }

      if (invite.expiresAt.getTime() < Date.now()) {
        await prisma.workspaceInvite.update({
          where: { id: invite.id },
          data: { status: "EXPIRED" },
        })
        return reply.code(410).send({ error: "Invite expired" })
      }

      if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
        return reply.code(403).send({ error: "Invite email mismatch" })
      }

      const result = await prisma.$transaction(async (tx) => {
        const revision = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const membership = await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: invite.workspaceId,
              userId,
            },
          },
          update: {
            role: invite.role,
            deletedAt: null,
            updatedAt: new Date(),
            revision,
          },
          create: {
            id: crypto.randomUUID(),
            workspaceId: invite.workspaceId,
            userId,
            role: invite.role,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            revision,
          },
        })

        const updatedInvite = await tx.workspaceInvite.update({
          where: { id: invite.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
            acceptedById: userId,
          },
        })

        const owners = await tx.workspaceMember.findMany({
          where: { workspaceId: invite.workspaceId, role: "OWNER", deletedAt: null },
          select: { userId: true },
        })
        const recipientIds = new Set<string>([userId, ...owners.map((owner) => owner.userId)])
        for (const recipientId of recipientIds) {
          await tx.serverChange.create({
            data: {
              userId: recipientId,
              entityType: "workspace_member",
              entityId: membership.id,
              opType: "UPSERT",
              payload: {
                id: membership.id,
                workspaceId: membership.workspaceId,
                userId: membership.userId,
                role: membership.role,
                createdAt: membership.createdAt.toISOString(),
                updatedAt: membership.updatedAt.toISOString(),
                deletedAt: membership.deletedAt,
                revision: membership.revision,
              },
              revision: membership.revision,
              updatedAt: membership.updatedAt,
            },
          })
        }

        return { membership, updatedInvite }
      })

      return reply.send({
        ok: true,
        workspace: { id: invite.workspaceId, label: invite.workspaceLabel, kind: "custom" },
        membership: {
          id: result.membership.id,
          workspaceId: result.membership.workspaceId,
          userId: result.membership.userId,
          role: result.membership.role,
          createdAt: result.membership.createdAt.toISOString(),
          updatedAt: result.membership.updatedAt.toISOString(),
          revision: result.membership.revision,
          deletedAt: result.membership.deletedAt,
        },
        invite: {
          id: result.updatedInvite.id,
          status: result.updatedInvite.status,
          acceptedAt: result.updatedInvite.acceptedAt?.toISOString() ?? null,
        },
      })
    },
  )

  app.get(
    "/me/invites",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user?.email) return reply.send([])

      const invites = await prisma.workspaceInvite.findMany({
        where: {
          status: "PENDING",
          email: normalizeEmail(user.email),
        },
        orderBy: { createdAt: "desc" },
      })

      const inviterIds = invites.map((invite) => invite.invitedById)
      const inviters = await prisma.user.findMany({
        where: { id: { in: inviterIds } },
        select: { id: true, email: true },
      })
      const inviterMap = new Map(inviters.map((inviter) => [inviter.id, inviter]))

      return reply.send(
        invites.map((invite) => ({
          id: invite.id,
          token: invite.token,
          workspace: { id: invite.workspaceId, label: invite.workspaceLabel },
          role: invite.role,
          expiresAt: invite.expiresAt.toISOString(),
          invitedBy: inviterMap.get(invite.invitedById) ?? { id: invite.invitedById, email: "" },
        })),
      )
    },
  )

  app.post(
    "/admin/workspaces/backfill-owners",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (process.env.NODE_ENV === "production") {
        return reply.code(403).send({ error: "FORBIDDEN" })
      }

      const { workspaceId, userId } = (request.body ?? {}) as {
        workspaceId?: string
        userId?: string
      }

      const results: Array<{ workspaceId: string; action: string }> = []

      if (workspaceId) {
        const members = await prisma.workspaceMember.findMany({
          where: { workspaceId, deletedAt: null },
          orderBy: { createdAt: "asc" },
        })
        const hasOwner = members.some((member) => member.role === "OWNER")
        if (hasOwner) {
          results.push({ workspaceId, action: "owner_exists" })
        } else if (userId) {
          await prisma.workspaceMember.upsert({
            where: { workspaceId_userId: { workspaceId, userId } },
            update: {
              role: "OWNER",
              deletedAt: null,
              updatedAt: new Date(),
              revision: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            },
            create: {
              id: crypto.randomUUID(),
              workspaceId,
              userId,
              role: "OWNER",
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              revision: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            },
          })
          results.push({ workspaceId, action: "owner_upserted" })
        } else if (members.length > 0) {
          const candidate = members[0]
          await prisma.workspaceMember.update({
            where: { id: candidate.id },
            data: {
              role: "OWNER",
              updatedAt: new Date(),
              revision: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            },
          })
          results.push({ workspaceId, action: "owner_promoted" })
        } else {
          results.push({ workspaceId, action: "no_members" })
        }

        return reply.send({ ok: true, results })
      }

      const allMembers = await prisma.workspaceMember.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      })

      const byWorkspace = new Map<string, typeof allMembers[number][]>()
      for (const member of allMembers) {
        const list = byWorkspace.get(member.workspaceId) ?? []
        list.push(member)
        byWorkspace.set(member.workspaceId, list)
      }

      for (const [id, members] of byWorkspace) {
        const hasOwner = members.some((member) => member.role === "OWNER")
        if (hasOwner) {
          results.push({ workspaceId: id, action: "owner_exists" })
          continue
        }
        const candidate = members[0]
        await prisma.workspaceMember.update({
          where: { id: candidate.id },
          data: {
            role: "OWNER",
            updatedAt: new Date(),
            revision: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          },
        })
        results.push({ workspaceId: id, action: "owner_promoted" })
      }

      return reply.send({ ok: true, results })
    },
  )
}
