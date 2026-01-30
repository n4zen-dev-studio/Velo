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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)
}

async function createVerificationToken(userId: string) {
  const rawToken = generateToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })
  return rawToken
}

function logVerificationUrl(rawToken: string, port: number) {
  if (!process.env.VERIFY_EMAIL_URL && process.env.NODE_ENV === "production") return
  const baseUrl = process.env.VERIFY_EMAIL_URL ?? `http://localhost:${port}`
  // eslint-disable-next-line no-console
  console.log(`[auth] Verify email: ${baseUrl}/auth/verify-email?token=${rawToken}`)
}

export async function authRoutes(app: FastifyInstance) {
  // Backwards compatibility: /auth/register -> /auth/signup (no upsert)
  app.post("/auth/register", async (request, reply) => {
    return app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: request.body,
    }).then((res) => reply.status(res.statusCode).send(res.json()))
  })
  // POST /auth/signup
  // curl -X POST http://localhost:8080/auth/signup -H "Content-Type: application/json" -d '{"email":"dev@tasktrak.io","password":"password123"}'
  app.post("/auth/signup", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    const normalized = normalizeEmail(email)

    if (!isValidEmail(normalized)) {
      return reply.code(400).send({ error: "Invalid email" })
    }
    if (!password || password.length < 8) {
      return reply.code(400).send({ error: "Password must be at least 8 characters" })
    }

    const existing = await prisma.user.findUnique({ where: { email: normalized } })
    if (existing) {
      return reply.code(409).send({ error: "Email already in use" })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email: normalized, passwordHash, emailVerifiedAt: null },
    })

    const rawToken = await createVerificationToken(user.id)
    logVerificationUrl(rawToken, Number(process.env.PORT ?? 8080))

    return reply.send({ ok: true, requiresEmailVerification: true })
  })

  // GET /auth/verify-email?token=...
  app.get("/auth/verify-email", async (request, reply) => {
    const { token } = request.query as { token?: string }
    if (!token) return reply.code(400).send({ error: "Token required" })
    const tokenHash = hashToken(token)

    const tokenRow = await prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (!tokenRow) {
      return reply.code(400).send({ error: "Invalid or expired token" })
    }

    await prisma.emailVerificationToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date() },
    })
    await prisma.user.update({
      where: { id: tokenRow.userId },
      data: { emailVerifiedAt: new Date() },
    })

    return reply.send({ ok: true })
  })

  // POST /auth/resend-verification
  // curl -X POST http://localhost:8080/auth/resend-verification -H "Content-Type: application/json" -d '{"email":"dev@tasktrak.io"}'
  app.post("/auth/resend-verification", async (request, reply) => {
    const { email } = request.body as { email: string }
    const normalized = normalizeEmail(email)
    const user = await prisma.user.findUnique({ where: { email: normalized } })
    if (user && !user.emailVerifiedAt) {
      const rawToken = await createVerificationToken(user.id)
      logVerificationUrl(rawToken, Number(process.env.PORT ?? 8080))
    }
    return reply.send({ ok: true })
  })

  app.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    const normalized = normalizeEmail(email)

    const user = await prisma.user.findUnique({ where: { email: normalized } })
    if (!user) return reply.code(401).send({ error: "Invalid credentials" })

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) return reply.code(401).send({ error: "Invalid credentials" })

    if (!user.emailVerifiedAt) {
      return reply.code(403).send({ error: "Email not verified", requiresEmailVerification: true })
    }

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

    const user = await prisma.user.findUnique({ where: { id: tokenRow.userId } })
    if (!user || !user.emailVerifiedAt) {
      return reply.code(403).send({ error: "Email not verified", requiresEmailVerification: true })
    }

    const accessToken = app.jwt.sign({ sub: tokenRow.userId }, { expiresIn: "15m" })
    return reply.send({ accessToken })
  })
}
