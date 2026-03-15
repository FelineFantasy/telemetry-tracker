import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ingestRoutes } from "./routes/ingest.js";
import { apiRoutes } from "./routes/api.js";

const port = Number(process.env.PORT) || 3001;
console.log("[api] PORT from env:", process.env.PORT, "-> using port", port);

const PAYLOAD_LIMIT = 200 * 1024; // 200 KB
const app = Fastify({ logger: true, bodyLimit: PAYLOAD_LIMIT });

try {
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });
  await app.register(cors, { origin: true });
  await app.register(ingestRoutes, { prefix: "/ingest" });
  await app.register(apiRoutes, { prefix: "/api" });

  await app.listen({ port, host: "0.0.0.0" });
  console.log("[api] Listening on", port);
} catch (err) {
  console.error("[api] Startup failed:", err);
  process.exit(1);
}
