import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";

/** Default DB retention for completed brief rows (days). */
export const BRIEF_COMPLETED_RETENTION_DAYS_DEFAULT = 30;

/** Default max age for serving a stale completed brief (days). */
export const BRIEF_STALE_MAX_DISPLAY_DAYS_DEFAULT = 7;

/** Worker total budget per job (ms). */
export const BRIEF_WORKER_TOTAL_BUDGET_MS_DEFAULT = 60_000;

/** Worker per-attempt timeout ceiling (ms). */
export const BRIEF_WORKER_ATTEMPT_TIMEOUT_MS_DEFAULT = 60_000;

/** Worker lease duration while processing a claimed job (ms). */
export const BRIEF_WORKER_LEASE_MS_DEFAULT = 60_000;

export type BriefAsyncConfig = {
  completedRetentionDays: number;
  staleMaxDisplayDays: number;
  workerTotalBudgetMs: number;
  workerAttemptTimeoutMs: number;
  workerLeaseMs: number;
  responseSchemaVersion: typeof BRIEF_RESPONSE_SCHEMA_VERSION;
};

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  label: string
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function resolveBriefAsyncConfig(env: NodeJS.ProcessEnv = process.env): BriefAsyncConfig {
  return {
    completedRetentionDays: parsePositiveInt(
      env.BRIEF_COMPLETED_RETENTION_DAYS,
      BRIEF_COMPLETED_RETENTION_DAYS_DEFAULT,
      "BRIEF_COMPLETED_RETENTION_DAYS"
    ),
    staleMaxDisplayDays: parsePositiveInt(
      env.BRIEF_STALE_MAX_DISPLAY_DAYS,
      BRIEF_STALE_MAX_DISPLAY_DAYS_DEFAULT,
      "BRIEF_STALE_MAX_DISPLAY_DAYS"
    ),
    workerTotalBudgetMs: parsePositiveInt(
      env.TELEMETRY_AI_BRIEF_WORKER_TOTAL_BUDGET_MS,
      BRIEF_WORKER_TOTAL_BUDGET_MS_DEFAULT,
      "TELEMETRY_AI_BRIEF_WORKER_TOTAL_BUDGET_MS"
    ),
    workerAttemptTimeoutMs: parsePositiveInt(
      env.TELEMETRY_AI_BRIEF_WORKER_ATTEMPT_TIMEOUT_MS,
      BRIEF_WORKER_ATTEMPT_TIMEOUT_MS_DEFAULT,
      "TELEMETRY_AI_BRIEF_WORKER_ATTEMPT_TIMEOUT_MS"
    ),
    workerLeaseMs: parsePositiveInt(
      env.TELEMETRY_AI_BRIEF_WORKER_LEASE_MS,
      BRIEF_WORKER_LEASE_MS_DEFAULT,
      "TELEMETRY_AI_BRIEF_WORKER_LEASE_MS"
    ),
    responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
  };
}
