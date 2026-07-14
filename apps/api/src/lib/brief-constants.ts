/** Snapshot contract version sent to the private brief service. */
export const BRIEF_SCHEMA_VERSION = "2026-07-brief-v1" as const;

/** Response contract version from the private brief service. */
export const BRIEF_RESPONSE_SCHEMA_VERSION = "2026-07-brief-response-v1" as const;

/** Maximum lookback for a brief window when acknowledgement is stale or missing. */
export const BRIEF_MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Upper bound on factual candidate lists per project (enforced in snapshot builder). */
export const BRIEF_MAX_CANDIDATES_PER_LIST = 10;

/** Maximum projects in one workspace brief snapshot. */
export const BRIEF_MAX_PROJECTS = 50;

/** Hard UTF-8 byte limit for the private-service payload. */
export const BRIEF_MAX_SNAPSHOT_BYTES = 256 * 1024;

/** Release rows per project in the snapshot. */
export const BRIEF_MAX_RELEASE_ROWS = 10;

/** Environment distribution rows per project. */
export const BRIEF_MAX_ENVIRONMENT_ROWS = 5;

/** Browser/OS slice rows per error group candidate. */
export const BRIEF_MAX_DEVICE_SLICE_ROWS = 5;

/** Maximum sanitized error message length before truncation ladder shortens further. */
export const BRIEF_MESSAGE_MAX_CHARS = 2000;

/** In-memory assembly chunk size (no database calls inside chunks). */
export const BRIEF_ASSEMBLY_CHUNK_SIZE = 5;

/** Factual-only fallback contract (Phase 3C routes). */
export const BRIEF_FALLBACK_SCHEMA_VERSION = "2026-07-brief-fallback-v1" as const;

/** Private brief HTTP path (signing canonical input). */
export const BRIEF_AI_WORKSPACE_PATH = "/v1/briefs/workspace" as const;

/** Signing protocol version included in the canonical payload. */
export const BRIEF_SIGNING_VERSION = "v1" as const;

/** Minimum decoded shared-secret length (bytes). */
export const BRIEF_SECRET_MIN_BYTES = 32;

/** Total wall-clock budget for one workspace-brief AI operation (ms). */
export const BRIEF_AI_TOTAL_BUDGET_MS = 2000;

/** Per-attempt ceiling when budget remains (ms). */
export const BRIEF_AI_ATTEMPT_TIMEOUT_MS = 2000;

/** Minimum remaining budget required before a retry is attempted (ms). */
export const BRIEF_AI_RETRY_MIN_REMAINING_MS = 250;

/** Maximum retries after the first attempt (synchronous path). */
export const BRIEF_AI_MAX_RETRIES = 1;

/** Served-brief metadata TTL (ms). */
export const BRIEF_SERVED_META_TTL_MS = 30 * 60 * 1000;

/** Max served-brief entries retained per user and organization. */
export const BRIEF_SERVED_META_MAX_PER_USER_ORG = 5;

/** Completed-minute bucket for shared requestUntil (ms). */
export const BRIEF_REQUEST_UNTIL_BUCKET_MS = 60_000;

/** Semantic brief cache TTL (ms). */
export const BRIEF_CACHE_TTL_MS = 15 * 60 * 1000;

/** Max semantic cache entries per process. */
export const BRIEF_CACHE_MAX_ENTRIES = 200;

/** Circuit failure threshold within the rolling window. */
export const BRIEF_CIRCUIT_FAILURE_THRESHOLD = 5;

/** Circuit failure rolling window (ms). */
export const BRIEF_CIRCUIT_WINDOW_MS = 60_000;

/** Circuit open cooldown before half-open probe (ms). */
export const BRIEF_CIRCUIT_COOLDOWN_MS = 30_000;
