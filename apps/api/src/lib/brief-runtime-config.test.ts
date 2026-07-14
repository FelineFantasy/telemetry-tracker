import { describe, expect, it } from "vitest";
import {
  BRIEF_AI_ATTEMPT_TIMEOUT_MS,
  BRIEF_AI_MAX_RETRIES,
  BRIEF_AI_RETRY_MIN_REMAINING_MS,
  BRIEF_AI_TOTAL_BUDGET_MS,
  BRIEF_CACHE_TTL_MS,
  BRIEF_CIRCUIT_COOLDOWN_MS,
  BRIEF_CIRCUIT_FAILURE_THRESHOLD,
  BRIEF_CIRCUIT_WINDOW_MS,
  BRIEF_REQUEST_UNTIL_BUCKET_MS,
  BRIEF_SERVED_META_TTL_MS,
} from "./brief-constants.js";
import {
  resolveBriefAiClientOptions,
  resolveBriefCacheOptions,
  resolveBriefCircuitOptions,
  resolveBriefServedMetaOptions,
  resolveRequestUntilBucketMs,
} from "./brief-runtime-config.js";

describe("brief runtime config", () => {
  it("uses documented env overrides when present", () => {
    const env = {
      BRIEF_REQUEST_UNTIL_BUCKET_MS: "120000",
      TELEMETRY_BRIEF_CACHE_TTL_MS: "600000",
      TELEMETRY_BRIEF_CACHE_MAX_ENTRIES: "50",
      TELEMETRY_BRIEF_SERVED_META_TTL_MS: "900000",
      TELEMETRY_BRIEF_SERVED_META_MAX_PER_USER_ORG: "9",
    };

    expect(resolveRequestUntilBucketMs(env)).toBe(120_000);
    expect(resolveBriefCacheOptions(env)).toEqual({ ttlMs: 600_000, maxEntries: 50 });
    expect(resolveBriefServedMetaOptions(env)).toEqual({ ttlMs: 900_000, maxPerUserOrg: 9 });
  });

  it("falls back to constants for missing or invalid env values", () => {
    const env = {
      BRIEF_REQUEST_UNTIL_BUCKET_MS: "0",
      TELEMETRY_BRIEF_CACHE_TTL_MS: "abc",
    };

    expect(resolveRequestUntilBucketMs(env)).toBe(BRIEF_REQUEST_UNTIL_BUCKET_MS);
    expect(resolveBriefCacheOptions(env).ttlMs).toBe(BRIEF_CACHE_TTL_MS);
    expect(resolveBriefServedMetaOptions({}).ttlMs).toBe(BRIEF_SERVED_META_TTL_MS);
  });

  it("falls back to circuit defaults for invalid env values", () => {
    expect(
      resolveBriefCircuitOptions({
        TELEMETRY_AI_BRIEF_CIRCUIT_FAILURE_THRESHOLD: "NaN",
        TELEMETRY_AI_BRIEF_CIRCUIT_WINDOW_MS: "-1",
        TELEMETRY_AI_BRIEF_CIRCUIT_COOLDOWN_MS: "0",
      })
    ).toEqual({
      failureThreshold: BRIEF_CIRCUIT_FAILURE_THRESHOLD,
      windowMs: BRIEF_CIRCUIT_WINDOW_MS,
      cooldownMs: BRIEF_CIRCUIT_COOLDOWN_MS,
    });
  });

  it("falls back to AI client defaults for invalid env values", () => {
    expect(
      resolveBriefAiClientOptions({
        TELEMETRY_AI_BRIEF_TOTAL_BUDGET_MS: "0",
        TELEMETRY_AI_BRIEF_ATTEMPT_TIMEOUT_MS: "abc",
        TELEMETRY_AI_BRIEF_MAX_RETRIES: "-1",
        TELEMETRY_AI_BRIEF_RETRY_MIN_REMAINING_MS: "",
      })
    ).toEqual({
      totalBudgetMs: BRIEF_AI_TOTAL_BUDGET_MS,
      attemptTimeoutMs: BRIEF_AI_ATTEMPT_TIMEOUT_MS,
      maxRetries: BRIEF_AI_MAX_RETRIES,
      retryMinRemainingMs: BRIEF_AI_RETRY_MIN_REMAINING_MS,
    });
  });

  it("allows zero max retries when explicitly configured", () => {
    expect(
      resolveBriefAiClientOptions({
        TELEMETRY_AI_BRIEF_MAX_RETRIES: "0",
      }).maxRetries
    ).toBe(0);
  });
});
