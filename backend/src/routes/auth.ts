import type { FastifyInstance } from "fastify"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"

import { query } from "../db"

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
    const result = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash
       RETURNING id`,
      [email, passwordHash],
    )

    const userId = result.rows[0]?.id
    const accessToken = app.jwt.sign({ sub: userId }, { expiresIn: "15m" })
    const refreshToken = generateToken()
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash)
       VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), userId, hashToken(refreshToken)],
    )

    return reply.send({ accessToken, refreshToken })
  })

  app.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    const userResult = await query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email],
    )

    const user = userResult.rows[0]
    if (!user) return reply.code(401).send({ error: "Invalid credentials" })

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) return reply.code(401).send({ error: "Invalid credentials" })

    const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: "15m" })
    const refreshToken = generateToken()
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash)
       VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), user.id, hashToken(refreshToken)],
    )

    return reply.send({ accessToken, refreshToken })
  })

  app.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }
    const tokenHash = hashToken(refreshToken)

    const tokenResult = await query<{ id: string; user_id: string; revoked_at: string | null }>(
      "SELECT id, user_id, revoked_at FROM refresh_tokens WHERE token_hash = $1",
      [tokenHash],
    )

    const tokenRow = tokenResult.rows[0]
    if (!tokenRow || tokenRow.revoked_at) {
      return reply.code(401).send({ error: "Invalid refresh token" })
    }

    const accessToken = app.jwt.sign({ sub: tokenRow.user_id }, { expiresIn: "15m" })
    return reply.send({ accessToken })
  })
}
