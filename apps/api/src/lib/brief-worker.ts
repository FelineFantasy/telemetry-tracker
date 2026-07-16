/**
 * Organization-scoped brief generation worker.
 *
 * Invariant: claims jobs by organizationId only — never userId, session, or permissions.
 * Rebuilds snapshots from live telemetry; never uses historical snapshot_json.
 */

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { postWorkspaceBrief, resolveBriefAiClientConfigFromEnv } from "./brief-client.js";
import { resolveBriefAsyncConfig } from "./brief-async-config.js";
import { upsertBriefCompleted, findCurrentBriefCompleted } from "./brief-completed.js";
import {
  claimNextBriefGenerationJob,
  completeBriefGenerationJob,
  expireBriefGenerationJob,
  failBriefGenerationJob,
  renewBriefGenerationJobLease,
  type BriefGenerationJobRow,
} from "./brief-generation-job.js";
import { buildOrganizationBriefSnapshot, loadOrganizationBriefContext } from "./brief-org-snapshot.js";
import { computePresentationHash } from "./brief-presentation-hash.js";
import { validatePrivateBriefResponse } from "./brief-validate-response.js";

export type BriefWorkerDeps = {
  prisma: PrismaClient;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  workerId?: string;
};

export type BriefWorkerProcessResult =
  | { status: "idle" }
  | { status: "expired"; jobId: string }
  | { status: "failed"; jobId: string; reason: string }
  | { status: "completed"; jobId: string; requestId: string };

function identityFromJob(job: BriefGenerationJobRow) {
  return {
    organizationId: job.organizationId,
    contentHash: job.contentHash,
    presentationHash: job.presentationHash,
    responseSchemaVersion: job.responseSchemaVersion,
  };
}

export async function processNextBriefGenerationJob(
  deps: BriefWorkerDeps
): Promise<BriefWorkerProcessResult> {
  const env = deps.env ?? process.env;
  const nowFn = deps.now ?? (() => new Date());
  const now = nowFn();
  const workerId = deps.workerId ?? `brief-worker-${randomUUID()}`;

  const job = await claimNextBriefGenerationJob(deps.prisma, { workerId, now, env });
  if (!job) {
    return { status: "idle" };
  }

  const context = await loadOrganizationBriefContext(deps.prisma, job.organizationId);
  if (!context.ok) {
    await expireBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return { status: "expired", jobId: job.id };
  }

  const built = await buildOrganizationBriefSnapshot(deps.prisma, {
    organizationId: job.organizationId,
    requestId: job.requestId,
    requestUntil: job.requestUntil,
  });

  if (!built.ok) {
    await expireBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return { status: "expired", jobId: job.id };
  }

  const presentationHash = computePresentationHash({
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    projects: built.snapshot.projects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      projectSlug: p.projectSlug,
    })),
  });

  const hashesMatch =
    built.contentHash === job.contentHash &&
    presentationHash === job.presentationHash &&
    built.snapshot.organizationId === job.organizationId;

  if (!hashesMatch) {
    await expireBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return { status: "expired", jobId: job.id };
  }

  const existingCompleted = await findCurrentBriefCompleted(
    deps.prisma,
    identityFromJob(job),
    now
  );
  if (existingCompleted) {
    const completed = await completeBriefGenerationJob(deps.prisma, {
      jobId: job.id,
      workerId,
      now: nowFn(),
    });
    if (!completed) {
      await expireBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
      return { status: "expired", jobId: job.id };
    }

    return {
      status: "completed",
      jobId: job.id,
      requestId: existingCompleted.requestId,
    };
  }

  const aiResolved = resolveBriefAiClientConfigFromEnv(env);
  if (!aiResolved.ok) {
    await failBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return {
      status: "failed",
      jobId: job.id,
      reason: aiResolved.code === "misconfigured" ? "ai_misconfigured" : "ai_unreachable",
    };
  }

  const leaseHeld = await renewBriefGenerationJobLease(deps.prisma, {
    jobId: job.id,
    workerId,
    now: nowFn(),
    env,
  });
  if (!leaseHeld) {
    await expireBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return { status: "expired", jobId: job.id };
  }

  const config = resolveBriefAsyncConfig(env);
  const aiConfig = {
    ...aiResolved.config,
    totalBudgetMs: config.workerTotalBudgetMs,
    attemptTimeoutMs: config.workerAttemptTimeoutMs,
    maxRetries: 0,
  };

  const aiResult = await postWorkspaceBrief(built.snapshot, built.contentHash, aiConfig);
  if (!aiResult.ok) {
    await failBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return { status: "failed", jobId: job.id, reason: aiResult.reason };
  }

  const validated = validatePrivateBriefResponse(built.snapshot, aiResult.response);
  if (!validated.ok) {
    await failBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return { status: "failed", jobId: job.id, reason: "ai_invalid_response" };
  }

  const brief = {
    ...validated.data,
    requestId: job.requestId,
  };

  await upsertBriefCompleted(deps.prisma, {
    identity: identityFromJob(job),
    requestId: job.requestId,
    snapshotHash: built.snapshotHash,
    brief,
    now: nowFn(),
    env,
  });

  const completed = await completeBriefGenerationJob(deps.prisma, {
    jobId: job.id,
    workerId,
    now: nowFn(),
  });
  if (!completed) {
    await expireBriefGenerationJob(deps.prisma, { jobId: job.id, workerId });
    return { status: "expired", jobId: job.id };
  }

  return { status: "completed", jobId: job.id, requestId: job.requestId };
}
