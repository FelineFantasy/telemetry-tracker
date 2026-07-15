import { describe, expect, it } from "vitest";
import {
  BRIEF_COMPLETED_RETENTION_DAYS_DEFAULT,
  BRIEF_STALE_MAX_DISPLAY_DAYS_DEFAULT,
  resolveBriefAsyncConfig,
} from "./brief-async-config.js";

describe("resolveBriefAsyncConfig", () => {
  it("uses documented defaults when env vars are unset", () => {
    const config = resolveBriefAsyncConfig({});
    expect(config.completedRetentionDays).toBe(BRIEF_COMPLETED_RETENTION_DAYS_DEFAULT);
    expect(config.staleMaxDisplayDays).toBe(BRIEF_STALE_MAX_DISPLAY_DAYS_DEFAULT);
    expect(config.workerTotalBudgetMs).toBe(60_000);
    expect(config.workerAttemptTimeoutMs).toBe(60_000);
  });

  it("parses overrides from env", () => {
    const config = resolveBriefAsyncConfig({
      BRIEF_COMPLETED_RETENTION_DAYS: "14",
      BRIEF_STALE_MAX_DISPLAY_DAYS: "3",
      TELEMETRY_AI_BRIEF_WORKER_TOTAL_BUDGET_MS: "45000",
      TELEMETRY_AI_BRIEF_WORKER_ATTEMPT_TIMEOUT_MS: "40000",
    });
    expect(config.completedRetentionDays).toBe(14);
    expect(config.staleMaxDisplayDays).toBe(3);
    expect(config.workerTotalBudgetMs).toBe(45_000);
    expect(config.workerAttemptTimeoutMs).toBe(40_000);
  });
});
