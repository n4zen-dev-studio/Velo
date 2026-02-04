import type { FastifyInstance } from "fastify"
import crypto from "node:crypto"

import { prisma } from "../prisma"

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
      const { workspaceId } = request.params as { workspaceId: string }
      const { email, workspaceLabel } = request.body as { email: string; workspaceLabel?: string }
      const inviterId = (request.user as { sub: string }).sub

      const normalized = normalizeEmail(email)
      if (!isValidEmail(normalized)) {
        return reply.code(400).send({ error: "Invalid email" })
      }

      const workspaceExists = await prisma.workspaceMember.findFirst({
        where: { workspaceId, deletedAt: null },
      })
      if (!workspaceExists) {
        return reply.code(404).send({ error: "WORKSPACE_NOT_FOUND" })
      }

      const isOwner = await requireWorkspaceOwner(inviterId, workspaceId)
      if (!isOwner) {
        return reply.code(403).send({ error: "NOT_OWNER" })
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
        return reply.send({ ok: true, workspaceId: invite.workspaceId })
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

      await prisma.$transaction(async (tx) => {
        const revision = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        await tx.workspaceMember.upsert({
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

        await tx.workspaceInvite.update({
          where: { id: invite.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
            acceptedById: userId,
          },
        })
      })

      return reply.send({ ok: true, workspaceId: invite.workspaceId })
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
