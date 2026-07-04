import type { FastifyCorsOptions } from "@fastify/cors";

/**
 * Production dashboard/API: set `CORS_ORIGINS` to a comma-separated list
 * (e.g. `https://app.example.com,http://localhost:3000`) or a single
 * `DASHBOARD_ORIGIN` / `TELEMETRY_DASHBOARD_ORIGIN`. Browser requests with
 * `credentials` must match one of these.
 *
 * Ingest (`/ingest/*`) allows any origin in production — API keys authenticate
 * ingest; browser SDKs run on customer domains.
 *
 * Non-production: all origins allowed (local dev).
 */
export function parseDashboardCorsAllowlist(): string[] {
  const raw =
    process.env.CORS_ORIGINS ??
    process.env.DASHBOARD_ORIGIN ??
    process.env.TELEMETRY_DASHBOARD_ORIGIN ??
    "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildDashboardCorsOptions(): Pick<
  FastifyCorsOptions,
  "origin" | "credentials"
> {
  const credentials = true;
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    return { origin: true, credentials };
  }

  const allowlist = parseDashboardCorsAllowlist();

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

/** Browser SDK ingest from arbitrary customer origins; no cookies. */
export function buildIngestCorsOptions(): Pick<
  FastifyCorsOptions,
  "origin" | "credentials"
> {
  return { origin: true, credentials: false };
}

function requestPath(url: string): string {
  return url.split("?")[0] ?? url;
}

export function isIngestPath(url: string): boolean {
  const path = requestPath(url);
  return path === "/ingest" || path.startsWith("/ingest/");
}

/** @fastify/cors dynamic delegate — ingest vs dashboard/API surfaces. */
export function resolveCorsOptionsForRequest(
  req: { url: string }
): Pick<FastifyCorsOptions, "origin" | "credentials"> {
  if (isIngestPath(req.url)) {
    return buildIngestCorsOptions();
  }
  return buildDashboardCorsOptions();
}

/** @deprecated Use resolveCorsOptionsForRequest via dynamic @fastify/cors registration. */
export function buildCorsOptions(): Pick<FastifyCorsOptions, "origin" | "credentials"> {
  return buildDashboardCorsOptions();
}
