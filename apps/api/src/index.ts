import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3001;
// Railway proxy often connects via IPv4; 0.0.0.0 avoids "connection refused" 502. Override with HOST=:: if needed.
const host = process.env.HOST ?? "0.0.0.0";
console.log("[api] PORT from env:", process.env.PORT, "HOST:", host, "-> listening on port", port);

try {
  const app = await createApp();
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
