import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { BriefGenerationJobStatus } from "@prisma/client";
import { findCurrentBriefCompleted, type BriefIdentity } from "./brief-completed.js";
import { resolveBriefAsyncConfig } from "./brief-async-config.js";

export type BriefGenerationJobRow = {
  id: string;
  organizationId: string;
  contentHash: string;
  presentationHash: string;
  responseSchemaVersion: string;
  requestId: string;
  requestUntil: Date;
  status: BriefGenerationJobStatus;
  attemptCount: number;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type EnqueueBriefGenerationJobInput = BriefIdentity & {
  requestUntil: Date;
};

type JobDbRow = {
  id: string;
  organization_id: string;
  content_hash: string;
  presentation_hash: string;
  response_schema_version: string;
  request_id: string;
  request_until: Date;
  status: BriefGenerationJobStatus;
  attempt_count: number;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

function mapJob(row: JobDbRow): BriefGenerationJobRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contentHash: row.content_hash,
    presentationHash: row.presentation_hash,
    responseSchemaVersion: row.response_schema_version,
    requestId: row.request_id,
    requestUntil: row.request_until,
    status: row.status,
    attemptCount: row.attempt_count,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function retryJobData(requestId: string, requestUntil: Date) {
  return {
    status: BriefGenerationJobStatus.PENDING,
    request_id: requestId,
    request_until: requestUntil,
    lease_owner: null,
    lease_expires_at: null,
    completed_at: null,
  };
}

export async function enqueueBriefGenerationJob(
  prisma: PrismaClient,
  input: EnqueueBriefGenerationJobInput
): Promise<BriefGenerationJobRow> {
  const requestId = randomUUID();
  try {
    const row = await prisma.briefGenerationJob.create({
      data: {
        organization_id: input.organizationId,
        content_hash: input.contentHash,
        presentation_hash: input.presentationHash,
        response_schema_version: input.responseSchemaVersion,
        request_id: requestId,
        request_until: input.requestUntil,
        status: BriefGenerationJobStatus.PENDING,
      },
    });
    return mapJob(row);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.briefGenerationJob.findUniqueOrThrow({
        where: {
          organization_id_content_hash_presentation_hash_response_schema_version: {
            organization_id: input.organizationId,
            content_hash: input.contentHash,
            presentation_hash: input.presentationHash,
            response_schema_version: input.responseSchemaVersion,
          },
        },
      });

      if (
        existing.status === BriefGenerationJobStatus.PENDING ||
        existing.status === BriefGenerationJobStatus.PROCESSING
      ) {
        return mapJob(existing);
      }

      if (existing.status === BriefGenerationJobStatus.COMPLETED) {
        const completedBrief = await findCurrentBriefCompleted(prisma, input);
        if (completedBrief) {
          return mapJob(existing);
        }
      }

      const retried = await prisma.briefGenerationJob.update({
        where: { id: existing.id },
        data: retryJobData(requestId, input.requestUntil),
      });
      return mapJob(retried);
    }
    throw error;
  }
}

function resolveWorkerLeaseMs(env?: NodeJS.ProcessEnv): number {
  const config = resolveBriefAsyncConfig(env);
  return (
    config.workerTotalBudgetMs +
    config.workerAttemptTimeoutMs +
    Math.max(config.workerLeaseMs, 10_000)
  );
}

export async function renewBriefGenerationJobLease(
  prisma: PrismaClient,
  input: { jobId: string; workerId: string; now: Date; env?: NodeJS.ProcessEnv }
): Promise<boolean> {
  const leaseExpiresAt = new Date(input.now.getTime() + resolveWorkerLeaseMs(input.env));
  const result = await prisma.briefGenerationJob.updateMany({
    where: {
      id: input.jobId,
      lease_owner: input.workerId,
      status: BriefGenerationJobStatus.PROCESSING,
    },
    data: { lease_expires_at: leaseExpiresAt },
  });
  return result.count > 0;
}

export async function claimNextBriefGenerationJob(
  prisma: PrismaClient,
  input: { workerId: string; now: Date; env?: NodeJS.ProcessEnv }
): Promise<BriefGenerationJobRow | null> {
  const leaseExpiresAt = new Date(input.now.getTime() + resolveWorkerLeaseMs(input.env));

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<JobDbRow[]>(Prisma.sql`
      SELECT *
      FROM "BriefGenerationJob"
      WHERE "status" IN ('PENDING', 'PROCESSING')
        AND ("lease_expires_at" IS NULL OR "lease_expires_at" < ${input.now})
      ORDER BY "created_at" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    const candidate = rows[0];
    if (!candidate) return null;

    const updated = await tx.briefGenerationJob.update({
      where: { id: candidate.id },
      data: {
        status: BriefGenerationJobStatus.PROCESSING,
        lease_owner: input.workerId,
        lease_expires_at: leaseExpiresAt,
        attempt_count: { increment: 1 },
      },
    });

    return mapJob(updated);
  });
}

export async function completeBriefGenerationJob(
  prisma: PrismaClient,
  input: { jobId: string; workerId: string; now: Date }
): Promise<boolean> {
  const result = await prisma.briefGenerationJob.updateMany({
    where: {
      id: input.jobId,
      lease_owner: input.workerId,
      status: BriefGenerationJobStatus.PROCESSING,
    },
    data: {
      status: BriefGenerationJobStatus.COMPLETED,
      completed_at: input.now,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
  return result.count > 0;
}

export async function expireBriefGenerationJob(
  prisma: PrismaClient,
  input: { jobId: string; workerId: string }
): Promise<boolean> {
  const result = await prisma.briefGenerationJob.updateMany({
    where: {
      id: input.jobId,
      lease_owner: input.workerId,
      status: BriefGenerationJobStatus.PROCESSING,
    },
    data: {
      status: BriefGenerationJobStatus.EXPIRED,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
  return result.count > 0;
}

export async function failBriefGenerationJob(
  prisma: PrismaClient,
  input: { jobId: string; workerId: string }
): Promise<boolean> {
  const result = await prisma.briefGenerationJob.updateMany({
    where: {
      id: input.jobId,
      lease_owner: input.workerId,
      status: BriefGenerationJobStatus.PROCESSING,
    },
    data: {
      status: BriefGenerationJobStatus.FAILED,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
  return result.count > 0;
}
