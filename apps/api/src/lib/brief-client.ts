/**
 * Signed HTTP client for the private workspace brief service.
 *
 * Uses one total wall-clock budget per operation. Retries consume only the
 * remaining budget and never add an explicit sleep delay.
 */

import {
  BRIEF_AI_ATTEMPT_TIMEOUT_MS,
  BRIEF_AI_MAX_RETRIES,
  BRIEF_AI_RETRY_MIN_REMAINING_MS,
  BRIEF_AI_TOTAL_BUDGET_MS,
  BRIEF_AI_WORKSPACE_PATH,
} from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import {
  buildBriefSigningHeaders,
  decodeBriefServiceSecret,
  type BriefSigningHeaders,
} from "./brief-signing.js";

export type BriefAiClientConfig = {
  baseUrl: string;
  secret: Buffer;
  totalBudgetMs?: number;
  attemptTimeoutMs?: number;
  maxRetries?: number;
  retryMinRemainingMs?: number;
  fetchImpl?: typeof fetch;
};

export type BriefAiEnvResolution =
  | { ok: true; config: BriefAiClientConfig }
  | { ok: false; code: "unconfigured" }
  | { ok: false; code: "misconfigured"; baseUrl: string };

export type BriefAiClientFailureReason =
  | "unconfigured"
  | "timeout"
  | "network"
  | "http_error"
  | "invalid_json"
  | "invalid_response"
  | "integrity_failed";

export type PostWorkspaceBriefResult =
  | {
      ok: true;
      response: unknown;
      attempts: number;
      latencyMs: number;
    }
  | {
      ok: false;
      reason: BriefAiClientFailureReason;
      status?: number;
      message: string;
      attempts: number;
      latencyMs: number;
    };

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 502 || status === 503 || status === 504;
}

function remainingBudgetMs(startedAt: number, totalBudgetMs: number): number {
  return Math.max(0, totalBudgetMs - (Date.now() - startedAt));
}

/** Resolve client config from environment variables. */
export function resolveBriefAiClientConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): BriefAiEnvResolution {
  const baseUrl = env.TELEMETRY_AI_BRIEF_URL?.trim();
  const secretEncoded = env.TELEMETRY_AI_BRIEF_SECRET?.trim();
  if (!baseUrl) {
    return { ok: false, code: "unconfigured" };
  }
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  if (!secretEncoded) {
    return { ok: false, code: "misconfigured", baseUrl: normalizedBaseUrl };
  }

  const secret = decodeBriefServiceSecret(secretEncoded);
  if (!secret) {
    return { ok: false, code: "misconfigured", baseUrl: normalizedBaseUrl };
  }

  return {
    ok: true,
    config: {
      baseUrl: normalizedBaseUrl,
      secret,
      totalBudgetMs: Number(env.TELEMETRY_AI_BRIEF_TOTAL_BUDGET_MS ?? BRIEF_AI_TOTAL_BUDGET_MS),
      attemptTimeoutMs: Number(
        env.TELEMETRY_AI_BRIEF_ATTEMPT_TIMEOUT_MS ?? BRIEF_AI_ATTEMPT_TIMEOUT_MS
      ),
      maxRetries: Number(env.TELEMETRY_AI_BRIEF_MAX_RETRIES ?? BRIEF_AI_MAX_RETRIES),
      retryMinRemainingMs: Number(
        env.TELEMETRY_AI_BRIEF_RETRY_MIN_REMAINING_MS ?? BRIEF_AI_RETRY_MIN_REMAINING_MS
      ),
    },
  };
}

export async function postWorkspaceBrief(
  snapshot: BriefSnapshotRequest,
  contentHash: string,
  config: BriefAiClientConfig
): Promise<PostWorkspaceBriefResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const startedAt = Date.now();
  const totalBudgetMs = config.totalBudgetMs ?? BRIEF_AI_TOTAL_BUDGET_MS;
  const attemptTimeoutMs = config.attemptTimeoutMs ?? BRIEF_AI_ATTEMPT_TIMEOUT_MS;
  const maxRetries = config.maxRetries ?? BRIEF_AI_MAX_RETRIES;
  const retryMinRemainingMs = config.retryMinRemainingMs ?? BRIEF_AI_RETRY_MIN_REMAINING_MS;

  const rawBody = Buffer.from(JSON.stringify(snapshot), "utf8");

  const url = `${trimTrailingSlash(config.baseUrl)}${BRIEF_AI_WORKSPACE_PATH}`;
  let attempts = 0;
  let lastMessage: string;

  while (true) {
    attempts += 1;
    const timestampSec = Math.floor(Date.now() / 1000);
    const signingHeaders: BriefSigningHeaders = buildBriefSigningHeaders(config.secret, {
      timestampSec,
      requestId: snapshot.requestId,
      contentHash,
      rawBody,
    });

    const remaining = remainingBudgetMs(startedAt, totalBudgetMs);
    if (remaining <= 0) {
      return {
        ok: false,
        reason: "timeout",
        message: "AI total budget exhausted",
        attempts,
        latencyMs: Date.now() - startedAt,
      };
    }

    const controller = new AbortController();
    const attemptBudget = Math.min(remaining, attemptTimeoutMs);
    const timeout = setTimeout(() => controller.abort(), attemptBudget);

    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...signingHeaders,
        },
        body: rawBody,
        signal: controller.signal,
      });

      const responseText = await res.text();
      if (!res.ok) {
        lastMessage = `AI HTTP ${res.status}`;
        const canRetry =
          attempts <= maxRetries &&
          isRetryableStatus(res.status) &&
          remainingBudgetMs(startedAt, totalBudgetMs) >= retryMinRemainingMs;
        if (canRetry) continue;
        return {
          ok: false,
          reason: "http_error",
          status: res.status,
          message: lastMessage,
          attempts,
          latencyMs: Date.now() - startedAt,
        };
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(responseText);
      } catch {
        return {
          ok: false,
          reason: "invalid_json",
          message: "AI response was not valid JSON",
          attempts,
          latencyMs: Date.now() - startedAt,
        };
      }

      return {
        ok: true,
        response: parsedJson,
        attempts,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      lastMessage = aborted ? "AI attempt timed out" : "AI network error";
      const canRetry =
        attempts <= maxRetries &&
        remainingBudgetMs(startedAt, totalBudgetMs) >= retryMinRemainingMs;
      if (canRetry) continue;
      return {
        ok: false,
        reason: aborted ? "timeout" : "network",
        message: lastMessage,
        attempts,
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Convenience wrapper that reads config from environment. */
export async function postWorkspaceBriefFromEnv(
  snapshot: BriefSnapshotRequest,
  contentHash: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<PostWorkspaceBriefResult> {
  const resolved = resolveBriefAiClientConfigFromEnv(env);
  if (!resolved.ok) {
    return {
      ok: false,
      reason: "unconfigured",
      message:
        resolved.code === "misconfigured"
          ? "TELEMETRY_AI_BRIEF_SECRET is missing or invalid"
          : "TELEMETRY_AI_BRIEF_URL is not configured",
      attempts: 0,
      latencyMs: 0,
    };
  }
  return postWorkspaceBrief(snapshot, contentHash, resolved.config);
}
