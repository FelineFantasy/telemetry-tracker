import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest, WorkspaceBriefResponse } from "./brief-contracts.js";
import { authorizeWorkspaceBrief } from "./brief-authz.js";
import { findCurrentBriefCompleted, findStaleBriefCompleted } from "./brief-completed.js";
import { enqueueBriefGenerationJob } from "./brief-generation-job.js";
import { buildOrganizationBriefSnapshot } from "./brief-org-snapshot.js";
import { buildWorkspaceBriefFallback } from "./brief-fallback.js";
import { computePresentationHash } from "./brief-presentation-hash.js";
import { floorToCompletedMinute } from "./brief-request-until.js";
import { resolveRequestUntilBucketMs } from "./brief-runtime-config.js";

/** Used when no completed brief exists yet and a generation job was enqueued. */
export const BRIEF_ASYNC_PENDING_UNAVAILABLE_REASON = "ai_unreachable" as const;

export type UnavailableReason =
  | typeof BRIEF_ASYNC_PENDING_UNAVAILABLE_REASON
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
      meta: BriefBuildMeta & { source: "ai" | "stale" };
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
};

function unavailableFallbackResult(input: {
  requestId: string;
  snapshotHash: string;
  contentHash: string;
  snapshot: BriefSnapshotRequest;
  buildMeta: BriefBuildMeta;
  now: Date;
  reason?: UnavailableReason;
}): Extract<WorkspaceBriefServiceResult, { status: "unavailable" }> {
  return {
    status: "unavailable",
    httpStatus: 200,
    requestId: input.requestId,
    snapshotHash: input.snapshotHash,
    contentHash: input.contentHash,
    reason: input.reason ?? BRIEF_ASYNC_PENDING_UNAVAILABLE_REASON,
    fallback: buildWorkspaceBriefFallback(input.snapshot, input.requestId, input.now),
    meta: input.buildMeta,
  };
}

function briefIdentity(
  organizationId: string,
  contentHash: string,
  presentationHash: string
) {
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
  const env = deps.env ?? process.env;

  const authz = await authorizeWorkspaceBrief(deps.prisma, input.userId, input.organizationId);
  if (!authz.ok) {
    if (authz.code === "no_projects") {
      return { status: "empty", httpStatus: 200, reason: "no_projects" };
    }
    return { status: "forbidden", httpStatus: 403 };
  }

  const requestUntil = floorToCompletedMinute(now, resolveRequestUntilBucketMs(env));
  const correlationRequestId = randomUUID();

  const built = await buildOrganizationBriefSnapshot(deps.prisma, {
    organizationId: authz.organizationId,
    requestId: correlationRequestId,
    requestUntil,
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

  const identity = briefIdentity(authz.organizationId, contentHash, presentationHash);

  const current = await findCurrentBriefCompleted(deps.prisma, identity);
  if (current) {
    return {
      status: "ok",
      httpStatus: 200,
      requestId: current.requestId,
      snapshotHash: current.snapshotHash,
      contentHash,
      brief: current.brief,
      meta: { ...buildMeta, source: "ai" },
    };
  }

  const stale = await findStaleBriefCompleted(deps.prisma, {
    organizationId: authz.organizationId,
    excludeIdentity: identity,
    now,
    env,
  });
  if (stale) {
    try {
      await enqueueBriefGenerationJob(deps.prisma, { ...identity, requestUntil });
    } catch {
      // Non-blocking: stale display must not fail when enqueue races or errors.
    }

    return {
      status: "ok",
      httpStatus: 200,
      requestId: stale.requestId,
      snapshotHash: stale.snapshotHash,
      contentHash: stale.contentHash,
      brief: stale.brief,
      meta: { ...buildMeta, source: "stale" },
    };
  }

  try {
    await enqueueBriefGenerationJob(deps.prisma, { ...identity, requestUntil });
  } catch {
    return {
      status: "error",
      httpStatus: 500,
      code: "internal_error",
      message: "Failed to enqueue brief generation job",
      meta: buildMeta,
    };
  }

  const fallbackRequestId = randomUUID();
  return unavailableFallbackResult({
    requestId: fallbackRequestId,
    snapshotHash,
    contentHash,
    snapshot,
    buildMeta,
    now,
  });
}
