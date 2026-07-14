import {
  BRIEF_CACHE_MAX_ENTRIES,
  BRIEF_CACHE_TTL_MS,
  BRIEF_CIRCUIT_COOLDOWN_MS,
  BRIEF_CIRCUIT_FAILURE_THRESHOLD,
  BRIEF_CIRCUIT_WINDOW_MS,
  BRIEF_REQUEST_UNTIL_BUCKET_MS,
  BRIEF_SERVED_META_MAX_PER_USER_ORG,
  BRIEF_SERVED_META_TTL_MS,
} from "./brief-constants.js";

function parsePositiveIntEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function resolveRequestUntilBucketMs(env: NodeJS.ProcessEnv = process.env): number {
  return parsePositiveIntEnv(env, "BRIEF_REQUEST_UNTIL_BUCKET_MS", BRIEF_REQUEST_UNTIL_BUCKET_MS);
}

export function resolveBriefCacheOptions(env: NodeJS.ProcessEnv = process.env): {
  ttlMs: number;
  maxEntries: number;
} {
  return {
    ttlMs: parsePositiveIntEnv(env, "TELEMETRY_BRIEF_CACHE_TTL_MS", BRIEF_CACHE_TTL_MS),
    maxEntries: parsePositiveIntEnv(env, "TELEMETRY_BRIEF_CACHE_MAX_ENTRIES", BRIEF_CACHE_MAX_ENTRIES),
  };
}

export function resolveBriefServedMetaOptions(env: NodeJS.ProcessEnv = process.env): {
  ttlMs: number;
  maxPerUserOrg: number;
} {
  return {
    ttlMs: parsePositiveIntEnv(env, "TELEMETRY_BRIEF_SERVED_META_TTL_MS", BRIEF_SERVED_META_TTL_MS),
    maxPerUserOrg: parsePositiveIntEnv(
      env,
      "TELEMETRY_BRIEF_SERVED_META_MAX_PER_USER_ORG",
      BRIEF_SERVED_META_MAX_PER_USER_ORG
    ),
  };
}

export function resolveBriefCircuitOptions(env: NodeJS.ProcessEnv = process.env): {
  failureThreshold: number;
  windowMs: number;
  cooldownMs: number;
} {
  return {
    failureThreshold: parsePositiveIntEnv(
      env,
      "TELEMETRY_AI_BRIEF_CIRCUIT_FAILURE_THRESHOLD",
      BRIEF_CIRCUIT_FAILURE_THRESHOLD
    ),
    windowMs: parsePositiveIntEnv(
      env,
      "TELEMETRY_AI_BRIEF_CIRCUIT_WINDOW_MS",
      BRIEF_CIRCUIT_WINDOW_MS
    ),
    cooldownMs: parsePositiveIntEnv(
      env,
      "TELEMETRY_AI_BRIEF_CIRCUIT_COOLDOWN_MS",
      BRIEF_CIRCUIT_COOLDOWN_MS
    ),
  };
}
