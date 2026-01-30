import type { FastifyInstance } from "fastify"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"

import { prisma } from "../prisma"

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
    })

    const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: "15m" })
    const refreshToken = generateToken()
    await prisma.refreshToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: hashToken(refreshToken),
      },
    })

    return reply.send({ accessToken, refreshToken })
  })

  app.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ error: "Invalid credentials" })

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) return reply.code(401).send({ error: "Invalid credentials" })

    const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: "15m" })
    const refreshToken = generateToken()
    await prisma.refreshToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: hashToken(refreshToken),
      },
    })

    return reply.send({ accessToken, refreshToken })
  })

  app.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }
    const tokenHash = hashToken(refreshToken)

    const tokenRow = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    })

    if (!tokenRow) {
      return reply.code(401).send({ error: "Invalid refresh token" })
    }

    const accessToken = app.jwt.sign({ sub: tokenRow.userId }, { expiresIn: "15m" })
    return reply.send({ accessToken })
  })
}
