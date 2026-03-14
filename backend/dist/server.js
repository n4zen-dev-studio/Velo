import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import dotenv from "dotenv";
import { authRoutes } from "./routes/auth";
import { syncRoutes } from "./routes/sync";
import { inviteRoutes } from "./routes/invites";
import { prisma } from "./prisma";
dotenv.config();
const app = Fastify({ logger: true });
const prismaDelegates = prisma;
if (!prismaDelegates.workspaceInvite) {
    app.log.error("[startup] Prisma client missing WorkspaceInvite delegate. Run prisma generate/migrate.");
}
app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? "dev_secret",
});
app.decorate("authenticate", async (request, reply) => {
    try {
        await request.jwtVerify();
    }
    catch (err) {
        reply.send(err);
    }
});
app.register(authRoutes);
app.register(syncRoutes);
app.register(inviteRoutes);
app.get("/health", async () => ({ ok: true }));
const port = Number(process.env.PORT ?? 8080);
app.listen({ port, host: "0.0.0.0" })
    .then(() => {
    app.log.info(`server listening on ${port}`);
})
    .catch(async (error) => {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
});
process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
});
