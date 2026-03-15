import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ingestRoutes } from "./routes/ingest.js";
import { apiRoutes } from "./routes/api.js";

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST ?? "::";
console.log("[api] PORT from env:", process.env.PORT, "HOST:", host, "-> listening on port", port);

const PAYLOAD_LIMIT = 200 * 1024; // 200 KB
const app = Fastify({ logger: true, bodyLimit: PAYLOAD_LIMIT });

try {
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });
  await app.register(cors, { origin: true });

  // No DB – use to confirm the process is reachable (e.g. before /api/overview)
  app.get("/health", async (_req, reply) => reply.code(200).send({ ok: true }));
  app.get("/", async (_req, reply) => reply.code(200).send({ service: "telemetry-api", ok: true }));

  await app.register(ingestRoutes, { prefix: "/ingest" });
  await app.register(apiRoutes, { prefix: "/api" });

  await app.listen({ port, host });
  // Railway proxy: Node’s default timeouts are too low and can cause 502 “connection refused”
  const nodeServer = app.server as { keepAliveTimeout?: number; headersTimeout?: number } | undefined;
  if (nodeServer) {
    nodeServer.keepAliveTimeout = 65000;
    nodeServer.headersTimeout = 66000;
  }
  console.log("[api] Listening on", port);
} catch (err) {
  console.error("[api] Startup failed:", err);
  process.exit(1);
}
