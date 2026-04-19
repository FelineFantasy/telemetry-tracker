import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { prisma } from "./lib/db.js";
import { buildCorsOptions } from "./lib/cors-config.js";
import {
  genReqId,
  initSentryIfConfigured,
  registerObservabilityHooks,
} from "./lib/observability.js";
import {
  rateLimitMaxApi,
  rateLimitMaxAuth,
  rateLimitMaxIngest,
  RATE_LIMIT_WINDOW_MS,
} from "./lib/rate-limit-env.js";
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

  await initSentryIfConfigured();

  const app = Fastify({
    logger: !isTest,
    bodyLimit: PAYLOAD_LIMIT,
    genReqId,
  });

  registerObservabilityHooks(app);

  await app.register(cors, buildCorsOptions());

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

  await app.register(
    async function ingestScope(f) {
      await f.register(rateLimit, {
        max: rateLimitMaxIngest(isTest),
        timeWindow: RATE_LIMIT_WINDOW_MS,
      });
      await f.register(ingestRoutes);
    },
    { prefix: "/ingest" }
  );

  await app.register(
    async function authScope(f) {
      await f.register(rateLimit, {
        max: rateLimitMaxAuth(isTest),
        timeWindow: RATE_LIMIT_WINDOW_MS,
      });
      await f.register(authRoutes);
    },
    { prefix: "/api" }
  );

  await app.register(
    async function apiScope(f) {
      await f.register(rateLimit, {
        max: rateLimitMaxApi(isTest),
        timeWindow: RATE_LIMIT_WINDOW_MS,
      });
      await f.register(apiRoutes);
      await f.register(projectDashboardRoutes);
    },
    { prefix: "/api" }
  );

  return app;
}
