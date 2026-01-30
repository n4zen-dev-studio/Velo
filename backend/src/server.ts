import Fastify from "fastify"
import fastifyJwt from "fastify-jwt"
import dotenv from "dotenv"

import { authRoutes } from "./routes/auth"
import { syncRoutes } from "./routes/sync"

dotenv.config()

const app = Fastify({ logger: true })

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET ?? "dev_secret",
})

app.decorate("authenticate", async (request: any, reply: any) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})

app.register(authRoutes)
app.register(syncRoutes)

app.get("/health", async () => ({ ok: true }))

const port = Number(process.env.PORT ?? 8080)
app.listen({ port, host: "0.0.0.0" })
