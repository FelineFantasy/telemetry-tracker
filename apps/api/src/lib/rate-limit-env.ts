/** Env-driven caps for @fastify/rate-limit (requests per {@link RATE_LIMIT_WINDOW_MS}). */

export const RATE_LIMIT_WINDOW_MS = 60_000;

function parsePositiveInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function rateLimitMaxIngest(isTest: boolean): number {
  return isTest ? 100_000 : parsePositiveInt("RATE_LIMIT_INGEST_MAX", 3000);
}

export function rateLimitMaxAuth(isTest: boolean): number {
  return isTest ? 100_000 : parsePositiveInt("RATE_LIMIT_AUTH_MAX", 30);
}

export function rateLimitMaxApi(isTest: boolean): number {
  return isTest ? 100_000 : parsePositiveInt("RATE_LIMIT_API_MAX", 300);
}
