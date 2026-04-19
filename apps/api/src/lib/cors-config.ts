import type { FastifyCorsOptions } from "@fastify/cors";

/**
 * Production: set `CORS_ORIGINS` to a comma-separated list (e.g. `https://app.example.com,http://localhost:3000`)
 * or a single `DASHBOARD_ORIGIN`. Browser requests with `credentials` must match one of these.
 * Non-production: all origins allowed (local dev).
 */
export function buildCorsOptions(): Pick<FastifyCorsOptions, "origin" | "credentials"> {
  const credentials = true;
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    return { origin: true, credentials };
  }

  const raw = process.env.CORS_ORIGINS ?? process.env.DASHBOARD_ORIGIN ?? "";
  const allowlist = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowlist.length === 0) {
    return {
      origin: false,
      credentials,
    };
  }

  return {
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowlist.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials,
  };
}
