import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest, WorkspaceBriefResponse } from "./brief-contracts.js";
import { authorizeWorkspaceBrief } from "./brief-authz.js";
import {
  briefSemanticCache,
  rebindCachedBriefResponse,
  type BriefCacheKey,
} from "./brief-cache.js";
import { acquireBriefPrivateCallPermission, getBriefCircuitBreaker } from "./brief-circuit.js";
import { postWorkspaceBrief, resolveBriefAiClientConfigFromEnv } from "./brief-client.js";
import { buildWorkspaceBriefFallback } from "./brief-fallback.js";
import { computePresentationHash } from "./brief-presentation-hash.js";
import { floorToCompletedMinute } from "./brief-request-until.js";
import { briefServedMetaStore } from "./brief-served-meta.js";
import { buildWorkspaceBriefSnapshot } from "./brief-snapshot.js";
import { validatePrivateBriefResponse } from "./brief-validate-response.js";

export type UnavailableReason =
  | "ai_timeout"
  | "ai_unreachable"
  | "ai_http_5xx"
  | "ai_misconfigured"
  | "ai_idempotency_conflict"
  | "ai_invalid_request"
  | "ai_invalid_response"
  | "circuit_open";

export type BriefBuildMeta = {
  truncated: boolean;
  truncationSteps: string[];
  droppedProjectIds: string[];
  byteLength: number;
};

export type WorkspaceBriefServiceResult =
  | {
      status: "ok";
      httpStatus: 200;
      requestId: string;
      snapshotHash: string;
      contentHash: string;
      brief: WorkspaceBriefResponse;
      meta: BriefBuildMeta & { source: "ai" | "cache"; aiLatencyMs?: number };
    }
  | {
      status: "unavailable";
      httpStatus: 200;
      requestId: string;
      snapshotHash: string;
      contentHash: string;
      reason: UnavailableReason;
      fallback: ReturnType<typeof buildWorkspaceBriefFallback>;
      meta: BriefBuildMeta;
    }
  | { status: "empty"; httpStatus: 200; reason: "no_projects" }
  | { status: "forbidden"; httpStatus: 403 }
  | {
      status: "error";
      httpStatus: 422 | 500;
      code: "snapshot_too_large" | "invalid_snapshot" | "internal_error";
      message: string;
      meta?: Partial<BriefBuildMeta>;
    };

export type WorkspaceBriefServiceDeps = {
  prisma: PrismaClient;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  cache?: typeof briefSemanticCache;
  servedMeta?: typeof briefServedMetaStore;
};

function mapAiFailure(
  result: Extract<Awaited<ReturnType<typeof postWorkspaceBrief>>, { ok: false }>
): UnavailableReason {
  if (result.reason === "timeout") return "ai_timeout";
  if (result.reason === "network" || result.reason === "unconfigured") return "ai_unreachable";
  if (result.status === 401 || result.status === 403) return "ai_misconfigured";
  if (result.status === 409) return "ai_idempotency_conflict";
  if (result.status === 400) return "ai_invalid_request";
  if (result.status && result.status >= 500) return "ai_http_5xx";
  if (result.reason === "invalid_json" || result.reason === "invalid_response") {
    return "ai_invalid_response";
  }
  return "ai_invalid_response";
}

function storeServedMeta(
  deps: WorkspaceBriefServiceDeps,
  userId: string,
  input: {
    requestId: string;
    snapshotHash: string;
    organizationId: string;
    source: "ai" | "cache";
    snapshot: BriefSnapshotRequest;
  }
): void {
  (deps.servedMeta ?? briefServedMetaStore).store(userId, {
    requestId: input.requestId,
    snapshotHash: input.snapshotHash,
    organizationId: input.organizationId,
    source: input.source,
    projects: input.snapshot.projects.map((p) => ({
      projectId: p.projectId,
      generatedThrough: p.window.until,
    })),
  });
}

function unavailableFallbackResult(input: {
  requestId: string;
  snapshotHash: string;
  contentHash: string;
  snapshot: BriefSnapshotRequest;
  buildMeta: BriefBuildMeta;
  now: Date;
  reason: UnavailableReason;
}): Extract<WorkspaceBriefServiceResult, { status: "unavailable" }> {
  return {
    status: "unavailable",
    httpStatus: 200,
    requestId: input.requestId,
    snapshotHash: input.snapshotHash,
    contentHash: input.contentHash,
    reason: input.reason,
    fallback: buildWorkspaceBriefFallback(input.snapshot, input.requestId, input.now),
    meta: input.buildMeta,
  };
}

function cacheKeyFor(
  organizationId: string,
  contentHash: string,
  presentationHash: string
): BriefCacheKey {
  return {
    organizationId,
    contentHash,
    presentationHash,
    responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
  };
}

export async function getWorkspaceBrief(
  deps: WorkspaceBriefServiceDeps,
  input: { userId: string; organizationId: string; timezone?: string | null }
): Promise<WorkspaceBriefServiceResult> {
  const nowFn = deps.now ?? (() => new Date());
  const now = nowFn();
  const cache = deps.cache ?? briefSemanticCache;
  const env = deps.env ?? process.env;

  const authz = await authorizeWorkspaceBrief(deps.prisma, input.userId, input.organizationId);
  if (!authz.ok) {
    if (authz.code === "no_projects") {
      return { status: "empty", httpStatus: 200, reason: "no_projects" };
    }
    return { status: "forbidden", httpStatus: 403 };
  }

  const requestId = randomUUID();
  const requestUntil = floorToCompletedMinute(now);

  const built = await buildWorkspaceBriefSnapshot(deps.prisma, {
    userId: input.userId,
    organizationId: authz.organizationId,
    requestId,
    requestUntil,
    viewerTimezone: input.timezone ?? undefined,
    projects: authz.projects,
  });

  if (!built.ok) {
    if (built.code === "no_projects") {
      return { status: "empty", httpStatus: 200, reason: "no_projects" };
    }
    if (built.code === "snapshot_too_large") {
      return {
        status: "error",
        httpStatus: 422,
        code: "snapshot_too_large",
        message: "Snapshot exceeds maximum size",
        meta: {
          truncated: (built.truncationSteps?.length ?? 0) > 0,
          truncationSteps: built.truncationSteps ?? [],
          droppedProjectIds: built.droppedProjectIds ?? [],
          byteLength: built.byteLength ?? 0,
        },
      };
    }
    return {
      status: "error",
      httpStatus: 500,
      code: "invalid_snapshot",
      message: built.error ?? "Invalid snapshot",
    };
  }

  const { snapshot, contentHash, snapshotHash, meta: buildMeta } = built;
  const presentationHash = computePresentationHash({
    organizationId: authz.organizationId,
    organizationName: authz.organizationName,
    projects: snapshot.projects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      projectSlug: p.projectSlug,
    })),
  });

  const cacheKey = cacheKeyFor(authz.organizationId, contentHash, presentationHash);
  const cached = cache.get(cacheKey, now.getTime());
  if (cached) {
    const rebound = rebindCachedBriefResponse(snapshot, cached, requestId, now);
    const validated = validatePrivateBriefResponse(snapshot, rebound);
    if (validated.ok) {
      storeServedMeta(deps, input.userId, {
        requestId,
        snapshotHash,
        organizationId: authz.organizationId,
        source: "cache",
        snapshot,
      });
      return {
        status: "ok",
        httpStatus: 200,
        requestId,
        snapshotHash,
        contentHash,
        brief: validated.data,
        meta: { ...buildMeta, source: "cache" },
      };
    }
    cache.evict(cacheKey);
  }

  const aiResolved = resolveBriefAiClientConfigFromEnv(env);

  if (!aiResolved.ok) {
    if (aiResolved.code === "misconfigured") {
      const breaker = getBriefCircuitBreaker(aiResolved.baseUrl);
      breaker.recordFailure({ immediateOpen: true });
      return unavailableFallbackResult({
        requestId,
        snapshotHash,
        contentHash,
        snapshot,
        buildMeta,
        now,
        reason: "ai_misconfigured",
      });
    }
    return unavailableFallbackResult({
      requestId,
      snapshotHash,
      contentHash,
      snapshot,
      buildMeta,
      now,
      reason: "ai_unreachable",
    });
  }

  const aiConfig = aiResolved.config;
  const breaker = getBriefCircuitBreaker(aiConfig.baseUrl);
  const permission = acquireBriefPrivateCallPermission(breaker);
  if (!permission.allowed) {
    return unavailableFallbackResult({
      requestId,
      snapshotHash,
      contentHash,
      snapshot,
      buildMeta,
      now,
      reason: "circuit_open",
    });
  }

  const probing = permission.probing;

  const aiResult = await postWorkspaceBrief(snapshot, contentHash, aiConfig);

  if (!aiResult.ok) {
    const reason = mapAiFailure(aiResult);
    if (reason === "ai_misconfigured") {
      breaker.recordFailure({ immediateOpen: true });
    } else if (
      reason === "ai_idempotency_conflict" ||
      reason === "ai_invalid_request" ||
      reason === "ai_invalid_response" ||
      reason === "ai_timeout" ||
      reason === "ai_unreachable" ||
      reason === "ai_http_5xx"
    ) {
      if (probing) breaker.endProbe(false);
      else breaker.recordFailure();
    }
    return unavailableFallbackResult({
      requestId,
      snapshotHash,
      contentHash,
      snapshot,
      buildMeta,
      now,
      reason,
    });
  }

  const validated = validatePrivateBriefResponse(snapshot, aiResult.response);
  if (!validated.ok) {
    if (probing) breaker.endProbe(false);
    else breaker.recordFailure();
    return unavailableFallbackResult({
      requestId,
      snapshotHash,
      contentHash,
      snapshot,
      buildMeta,
      now,
      reason: "ai_invalid_response",
    });
  }

  if (probing) breaker.endProbe(true);
  else breaker.recordSuccess();

  cache.put(cacheKey, {
    contentHash,
    presentationHash,
    responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    workspace: validated.data.workspace,
    projects: validated.data.projects.map(({ generatedThrough: _gt, ...rest }) => rest),
  });

  storeServedMeta(deps, input.userId, {
    requestId,
    snapshotHash,
    organizationId: authz.organizationId,
    source: "ai",
    snapshot,
  });

  return {
    status: "ok",
    httpStatus: 200,
    requestId,
    snapshotHash,
    contentHash,
    brief: validated.data,
    meta: { ...buildMeta, source: "ai", aiLatencyMs: aiResult.latencyMs },
  };
}
