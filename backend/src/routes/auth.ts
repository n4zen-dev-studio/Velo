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

export function isValidEmail(email: string): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)
}

function isUserVerified(user: { emailVerified: boolean; emailVerifiedAt: Date | null }) {
  return user.emailVerified || !!user.emailVerifiedAt
}

async function setVerificationToken(userId: string) {
  const rawToken = generateToken()
  const tokenHash = hashToken(rawToken)
  await prisma.user.update({
    where: { id: userId },
    data: { verificationTokenHash: tokenHash },
  })
  return rawToken
}

function logVerificationToken(rawToken: string) {
  if (process.env.NODE_ENV === "production") return
  // eslint-disable-next-line no-console
  console.log(`[auth] Verify email token: ${rawToken}`)
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  // curl -X POST http://localhost:8080/auth/register -H "Content-Type: application/json" -d '{"email":"dev@tasktrak.io","password":"password123"}'
  app.post("/auth/register", async (request, reply) => {
    const { email, password, username } = request.body as {
      email: string
      password: string
      username?: string
    }
    const normalized = normalizeEmail(email)
    const normalizedUsername = username?.trim()

    if (!isValidEmail(normalized)) {
      return reply.code(400).send({ error: "Invalid email" })
    }
    if (!password || password.length < 8) {
      return reply.code(400).send({ error: "Password must be at least 8 characters" })
    }
    if (normalizedUsername) {
      if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
        return reply.code(400).send({ error: "Username must be 3-20 characters" })
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
        return reply
          .code(400)
          .send({ error: "Username can only use letters, numbers, dots, underscores, and dashes" })
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: normalized } })
    if (existing) {
      return reply.code(409).send({ error: "Email already in use" })
    }
    if (normalizedUsername) {
      const existingUsername = await prisma.user.findFirst({ where: { username: normalizedUsername } })
      if (existingUsername) {
        return reply.code(409).send({ error: "Username already in use" })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date()
    const user = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        username: normalizedUsername ?? null,
        emailVerified: false,
        emailVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    })

    const rawToken = await setVerificationToken(user.id)
    logVerificationToken(rawToken)

    return reply.send({ ok: true, requiresEmailVerification: true })
  })

  // POST /auth/verify-email
  // curl -X POST http://localhost:8080/auth/verify-email -H "Content-Type: application/json" -d '{"token":"..."}'
  app.post("/auth/verify-email", async (request, reply) => {
    const { token } = request.body as { token?: string }
    if (!token) return reply.code(400).send({ error: "Token required" })
    const tokenHash = hashToken(token)

    const user = await prisma.user.findFirst({ where: { verificationTokenHash: tokenHash } })
    if (!user) return reply.code(400).send({ error: "Invalid token" })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationTokenHash: null,
      },
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

  // POST /auth/resend-verification
  // curl -X POST http://localhost:8080/auth/resend-verification -H "Content-Type: application/json" -d '{"email":"dev@tasktrak.io"}'
  app.post("/auth/resend-verification", async (request, reply) => {
    const { email } = request.body as { email: string }
    const normalized = normalizeEmail(email)
    const user = await prisma.user.findUnique({ where: { email: normalized } })
    if (user && !isUserVerified(user)) {
      const rawToken = await setVerificationToken(user.id)
      logVerificationToken(rawToken)
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

    if (!isUserVerified(user)) {
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
    if (!user || !isUserVerified(user)) {
      return reply.code(403).send({ error: "Email not verified", requiresEmailVerification: true })
    }

    const accessToken = app.jwt.sign({ sub: tokenRow.userId }, { expiresIn: "15m" })
    return reply.send({ accessToken })
  })

  // POST /auth/request-password-reset
  // curl -X POST http://localhost:8080/auth/request-password-reset -H "Content-Type: application/json" -d '{"email":"dev@tasktrak.io"}'
  app.post("/auth/request-password-reset", async (request, reply) => {
    const { email } = request.body as { email: string }
    const normalized = normalizeEmail(email)
    const user = await prisma.user.findUnique({ where: { email: normalized } })
    if (user) {
      const rawToken = generateToken()
      const tokenHash = hashToken(rawToken)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      })
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log(`[auth] Password reset token: ${rawToken}`)
      }
    }
    return reply.send({ ok: true })
  })

  // POST /auth/reset-password
  // curl -X POST http://localhost:8080/auth/reset-password -H "Content-Type: application/json" -d '{"token":"...","newPassword":"newpass123"}'
  app.post("/auth/reset-password", async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string }
    if (!token || !newPassword || newPassword.length < 8) {
      return reply.code(400).send({ error: "Invalid request" })
    }
    const tokenHash = hashToken(token)
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    })
    if (!user) return reply.code(400).send({ error: "Invalid or expired token" })

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    })
    return reply.send({ ok: true })
  })

  // POST /auth/google
  app.post("/auth/google", async (request, reply) => {
    const { idToken } = request.body as { idToken: string }
    if (!idToken) return reply.code(400).send({ error: "Token required" })

    const tokenInfo = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`)
    if (!tokenInfo.ok) return reply.code(401).send({ error: "Invalid token" })
    const payload = (await tokenInfo.json()) as {
      email?: string
      sub?: string
      email_verified?: string
    }

    if (!payload.email || !payload.sub) {
      return reply.code(401).send({ error: "Invalid token" })
    }
    if (payload.email_verified !== "true") {
      return reply.code(401).send({ error: "Email not verified" })
    }

    const normalized = normalizeEmail(payload.email)
    const user = await prisma.user.upsert({
      where: { email: normalized },
      update: {
        googleSub: payload.sub,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationTokenHash: null,
      },
      create: {
        email: normalized,
        passwordHash: await bcrypt.hash(generateToken(), 10),
        googleSub: payload.sub,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
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
}
