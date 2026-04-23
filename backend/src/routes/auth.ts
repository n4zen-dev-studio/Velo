import bcrypt from "bcryptjs"
import type { FastifyInstance } from "fastify"
import crypto from "node:crypto"

import { sendMail } from "../mail"
import { prisma } from "../prisma"

const SIGNUP_CODE_PURPOSE = "signup"
const PASSWORD_RESET_CODE_PURPOSE = "password_reset"
const AUTH_CODE_TTL_MS = 15 * 60 * 1000

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

function generateSixDigitCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)
}

function isValidVerificationCode(code: string | undefined): code is string {
  return /^\d{6}$/.test(code ?? "")
}

function isUserVerified(user: { emailVerified: boolean; emailVerifiedAt: Date | null }) {
  return user.emailVerified || !!user.emailVerifiedAt
}

function createRouteError(statusCode: number, payload: Record<string, unknown>) {
  const error = new Error(String(payload.error ?? "Request failed")) as Error & {
    statusCode: number
    payload: Record<string, unknown>
  }
  error.statusCode = statusCode
  error.payload = payload
  return error
}

async function issueAuthTokens(app: FastifyInstance, userId: string) {
  const accessToken = app.jwt.sign({ sub: userId }, { expiresIn: "15m" })
  const refreshToken = generateToken()

  await prisma.refreshToken.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashValue(refreshToken),
    },
  })

  return { accessToken, refreshToken }
}

async function sendSignupVerificationCode(email: string, code: string) {
  await sendMail({
    to: email,
    subject: "Your Velo verification code",
    text: `Your Velo verification code is ${code}. It expires in 15 minutes.`,
    html: `<p>Your Velo verification code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`,
  })
}

async function sendPasswordResetCode(email: string, code: string) {
  await sendMail({
    to: email,
    subject: "Your Velo password reset code",
    text: `Your Velo password reset code is ${code}. It expires in 15 minutes.`,
    html: `<p>Your Velo password reset code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`,
  })
}

async function upsertAuthCode(params: {
  email: string
  purpose: string
  code: string
  passwordHash?: string | null
  username?: string | null
  userId?: string | null
}) {
  return prisma.authCode.upsert({
    where: {
      email_purpose: {
        email: params.email,
        purpose: params.purpose,
      },
    },
    update: {
      codeHash: hashValue(params.code),
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      usedAt: null,
      passwordHash: params.passwordHash ?? null,
      username: params.username ?? null,
      userId: params.userId ?? null,
    },
    create: {
      email: params.email,
      purpose: params.purpose,
      codeHash: hashValue(params.code),
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      usedAt: null,
      passwordHash: params.passwordHash ?? null,
      username: params.username ?? null,
      userId: params.userId ?? null,
    },
  })
}

async function findPendingSignup(email: string) {
  return prisma.authCode.findUnique({
    where: {
      email_purpose: {
        email,
        purpose: SIGNUP_CODE_PURPOSE,
      },
    },
  })
}

async function findUsernameConflict(username: string, emailToExclude?: string) {
  const existingUser = await prisma.user.findFirst({
    where: {
      username,
      ...(emailToExclude ? { NOT: { email: emailToExclude } } : {}),
    },
  })
  if (existingUser && isUserVerified(existingUser)) {
    return "Username already in use"
  }

  const existingPendingSignup = await prisma.authCode.findFirst({
    where: {
      purpose: SIGNUP_CODE_PURPOSE,
      username,
      ...(emailToExclude ? { NOT: { email: emailToExclude } } : {}),
    },
  })
  if (existingPendingSignup) {
    return "Username already in use"
  }

  return null
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const { email, password, username } = request.body as {
      email: string
      password: string
      username?: string
    }
    const normalized = normalizeEmail(email)
    const normalizedUsername = username?.trim() || null

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

    const existingUser = await prisma.user.findUnique({ where: { email: normalized } })
    if (existingUser && isUserVerified(existingUser)) {
      return reply.code(409).send({ error: "Email already in use" })
    }

    if (normalizedUsername) {
      const usernameConflict = await findUsernameConflict(normalizedUsername, normalized)
      if (usernameConflict) {
        return reply.code(409).send({ error: usernameConflict })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const code = generateSixDigitCode()

    await upsertAuthCode({
      email: normalized,
      purpose: SIGNUP_CODE_PURPOSE,
      code,
      passwordHash,
      username: normalizedUsername,
    })

    try {
      await sendSignupVerificationCode(normalized, code)
    } catch (error) {
      request.log.error({ err: error, email: normalized }, "[auth] Failed to send signup code")
      return reply.code(500).send({ error: "Unable to send verification code" })
    }

    return reply.send({
      ok: true,
      requiresEmailVerification: true,
    })
  })

  app.post("/auth/verify-email", async (request, reply) => {
    const { email, code, token } = request.body as {
      email?: string
      code?: string
      token?: string
    }
    const normalized = normalizeEmail(email ?? "")
    const verificationCode = code ?? token

    if (!isValidEmail(normalized) || !isValidVerificationCode(verificationCode)) {
      return reply.code(400).send({ error: "Invalid request" })
    }

    try {
      const result = await prisma.$transaction(async (tx: any) => {
        const pendingSignup = await tx.authCode.findUnique({
          where: {
            email_purpose: {
              email: normalized,
              purpose: SIGNUP_CODE_PURPOSE,
            },
          },
        })

        if (
          !pendingSignup ||
          pendingSignup.usedAt ||
          pendingSignup.expiresAt <= new Date() ||
          !pendingSignup.passwordHash ||
          pendingSignup.codeHash !== hashValue(verificationCode)
        ) {
          throw createRouteError(400, { error: "Invalid or expired code" })
        }

        if (pendingSignup.username) {
          const usernameOwner = await tx.user.findFirst({
            where: {
              username: pendingSignup.username,
              NOT: { email: normalized },
            },
          })
          if (usernameOwner && isUserVerified(usernameOwner)) {
            throw createRouteError(409, { error: "Username already in use" })
          }
        }

        const existingUser = await tx.user.findUnique({ where: { email: normalized } })
        if (existingUser && isUserVerified(existingUser)) {
          throw createRouteError(409, { error: "Email already in use" })
        }

        const now = new Date()
        const user =
          existingUser && !isUserVerified(existingUser)
            ? await tx.user.update({
                where: { id: existingUser.id },
                data: {
                  passwordHash: pendingSignup.passwordHash,
                  username: pendingSignup.username ?? null,
                  emailVerified: true,
                  emailVerifiedAt: now,
                  verificationTokenHash: null,
                },
              })
            : await tx.user.create({
                data: {
                  email: normalized,
                  passwordHash: pendingSignup.passwordHash,
                  username: pendingSignup.username ?? null,
                  emailVerified: true,
                  emailVerifiedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              })

        await tx.authCode.update({
          where: { id: pendingSignup.id },
          data: { usedAt: now },
        })

        const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: "15m" })
        const refreshToken = generateToken()
        await tx.refreshToken.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            tokenHash: hashValue(refreshToken),
          },
        })

        return { accessToken, refreshToken }
      })

      return reply.send(result)
    } catch (error: any) {
      if (error?.statusCode) {
        return reply.code(error.statusCode).send(error.payload)
      }
      request.log.error({ err: error, email: normalized }, "[auth] Verify email failed")
      return reply.code(500).send({ error: "Unable to verify email" })
    }
  })

  app.post("/auth/resend-verification", async (request, reply) => {
    const { email } = request.body as { email: string }
    const normalized = normalizeEmail(email)

    if (!isValidEmail(normalized)) {
      return reply.code(400).send({ error: "Invalid email" })
    }

    const pendingSignup = await findPendingSignup(normalized)
    const legacyUnverifiedUser = pendingSignup
      ? null
      : await prisma.user.findUnique({ where: { email: normalized } })

    if (!pendingSignup && (!legacyUnverifiedUser || isUserVerified(legacyUnverifiedUser))) {
      return reply.send({ ok: true })
    }

    const code = generateSixDigitCode()
    await upsertAuthCode({
      email: normalized,
      purpose: SIGNUP_CODE_PURPOSE,
      code,
      passwordHash: pendingSignup?.passwordHash ?? legacyUnverifiedUser?.passwordHash ?? null,
      username: pendingSignup?.username ?? legacyUnverifiedUser?.username ?? null,
    })

    try {
      await sendSignupVerificationCode(normalized, code)
    } catch (error) {
      request.log.error({ err: error, email: normalized }, "[auth] Failed to resend signup code")
      return reply.code(500).send({ error: "Unable to send verification code" })
    }

    return reply.send({ ok: true })
  })

  app.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    const normalized = normalizeEmail(email)

    const user = await prisma.user.findUnique({ where: { email: normalized } })
    if (!user) {
      const pendingSignup = await findPendingSignup(normalized)
      if (pendingSignup) {
        return reply.code(403).send({ error: "Email not verified", requiresEmailVerification: true })
      }
      return reply.code(401).send({ error: "Invalid credentials" })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) return reply.code(401).send({ error: "Invalid credentials" })

    if (!isUserVerified(user)) {
      return reply.code(403).send({ error: "Email not verified", requiresEmailVerification: true })
    }

    const auth = await issueAuthTokens(app, user.id)
    return reply.send(auth)
  })

  app.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }
    const tokenHash = hashValue(refreshToken)

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

  app.post("/auth/request-password-reset", async (request, reply) => {
    const { email } = request.body as { email: string }
    const normalized = normalizeEmail(email)



    if (!isValidEmail(normalized)) {
      return reply.send({ ok: true })
    }

    request.log.info({ email: normalized }, "[auth] reset requested")

    const user = await prisma.user.findUnique({ where: { email: normalized } })

    request.log.info(
      {
        email: normalized,
        foundUser: !!user,
        verified: !!user && isUserVerified(user),
      },
      "[auth] reset lookup result",
    )
    if (!user || !isUserVerified(user)) {
      return reply.send({ ok: true })
    }

    const code = generateSixDigitCode()
    await upsertAuthCode({
      email: normalized,
      purpose: PASSWORD_RESET_CODE_PURPOSE,
      code,
      userId: user.id,
    })

    try {
      await sendPasswordResetCode(normalized, code)
    } catch (error) {
      request.log.error({ err: error, email: normalized }, "[auth] Failed to send reset code")
      return reply.code(500).send({ error: "Unable to send reset code" })
    }

    return reply.send({ ok: true })
  })

  app.post("/auth/reset-password", async (request, reply) => {
    const { email, code, token, newPassword } = request.body as {
      email?: string
      code?: string
      token?: string
      newPassword: string
    }
    const normalized = normalizeEmail(email ?? "")
    const verificationCode = code ?? token

    if (
      !isValidEmail(normalized) ||
      !isValidVerificationCode(verificationCode) ||
      !newPassword ||
      newPassword.length < 8
    ) {
      return reply.code(400).send({ error: "Invalid request" })
    }

    try {
      await prisma.$transaction(async (tx: any) => {
        const resetCode = await tx.authCode.findUnique({
          where: {
            email_purpose: {
              email: normalized,
              purpose: PASSWORD_RESET_CODE_PURPOSE,
            },
          },
        })

        if (
          !resetCode ||
          resetCode.usedAt ||
          resetCode.expiresAt <= new Date() ||
          !resetCode.userId ||
          resetCode.codeHash !== hashValue(verificationCode)
        ) {
          throw createRouteError(400, { error: "Invalid or expired code" })
        }

        const user = await tx.user.findUnique({ where: { id: resetCode.userId } })
        if (!user || !isUserVerified(user) || user.email !== normalized) {
          throw createRouteError(400, { error: "Invalid or expired code" })
        }

        const now = new Date()
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await bcrypt.hash(newPassword, 10),
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          },
        })

        await tx.authCode.update({
          where: { id: resetCode.id },
          data: { usedAt: now },
        })

        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        })
      })

      return reply.send({ ok: true })
    } catch (error: any) {
      if (error?.statusCode) {
        return reply.code(error.statusCode).send(error.payload)
      }
      request.log.error({ err: error, email: normalized }, "[auth] Reset password failed")
      return reply.code(500).send({ error: "Unable to reset password" })
    }
  })

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

    const auth = await issueAuthTokens(app, user.id)
    return reply.send(auth)
  })

  app.post("/auth/logout", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string }
    if (refreshToken) {
      const tokenHash = hashValue(refreshToken)
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
    return reply.code(200).send({ ok: true })
  })
}
