import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ingestRoutes } from "./routes/ingest.js";
import { apiRoutes } from "./routes/api.js";
import { projectDashboardRoutes } from "./routes/project-dashboard.js";

const port = Number(process.env.PORT) || 3001;
// Railway proxy often connects via IPv4; 0.0.0.0 avoids "connection refused" 502. Override with HOST=:: if needed.
const host = process.env.HOST ?? "0.0.0.0";
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

  // Ingest first: resolves project via API key + writes UsageMonthly; read API uses env-scoped project.
  await app.register(ingestRoutes, { prefix: "/ingest" });
  await app.register(apiRoutes, { prefix: "/api" });
  await app.register(projectDashboardRoutes, { prefix: "/api" });

  await app.listen({ port, host });
  // Railway proxy: Node’s default timeouts are too low and can cause 502 “connection refused”
  const nodeServer = app.server as { keepAliveTimeout?: number; headersTimeout?: number } | undefined;
  if (nodeServer) {
    nodeServer.keepAliveTimeout = 65000;
    nodeServer.headersTimeout = 66000;
  }
  const addr = (app.server as { address?: () => { address: string; port: number } | null }).address?.();
  console.log("[api] Listening on", addr ? `${addr.address}:${addr.port}` : `port ${port}`);
} catch (err) {
  console.error("[api] Startup failed:", err);
  process.exit(1);
}
