import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { prisma } from "./lib/db.js";
import { ingestRoutes } from "./routes/ingest.js";
import { apiRoutes } from "./routes/api.js";
import { authRoutes } from "./routes/auth.js";
import { projectDashboardRoutes } from "./routes/project-dashboard.js";

const PAYLOAD_LIMIT = 200 * 1024; // 200 KB

/**
 * Build the Fastify app (no listen). Used by the server entrypoint and Vitest `inject()`.
 */
export async function createApp(): Promise<FastifyInstance> {
  const isTest = process.env.NODE_ENV === "test";
  const app = Fastify({
    logger: !isTest,
    bodyLimit: PAYLOAD_LIMIT,
  });

  await app.register(rateLimit, {
    max: isTest ? 100_000 : 300,
    timeWindow: "1 minute",
  });
  await app.register(cors, { origin: true, credentials: true });

  // Set HEALTH_CHECK_DATABASE=true in production (or staging) to verify DB connectivity; omit in dev if you prefer a dependency-free /health.
  app.get("/health", async (_req, reply) => {
    if (process.env.HEALTH_CHECK_DATABASE === "true") {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return reply.code(200).send({ ok: true, database: "ok" });
      } catch {
        return reply.code(503).send({ ok: false, database: "unavailable" });
      }
    }
    return reply.code(200).send({ ok: true });
  });
  app.get("/", async (_req, reply) =>
    reply.code(200).send({ service: "telemetry-api", ok: true })
  );

  await app.register(ingestRoutes, { prefix: "/ingest" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(apiRoutes, { prefix: "/api" });
  await app.register(projectDashboardRoutes, { prefix: "/api" });

  return app;
}
