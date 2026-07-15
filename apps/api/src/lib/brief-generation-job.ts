import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { BriefGenerationJobStatus } from "@prisma/client";
import type { BriefIdentity } from "./brief-completed.js";
import { resolveBriefAsyncConfig } from "./brief-async-config.js";

export type BriefGenerationJobRow = {
  id: string;
  organizationId: string;
  contentHash: string;
  presentationHash: string;
  responseSchemaVersion: string;
  requestId: string;
  status: BriefGenerationJobStatus;
  attemptCount: number;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

function mapJob(row: {
  id: string;
  organization_id: string;
  content_hash: string;
  presentation_hash: string;
  response_schema_version: string;
  request_id: string;
  status: BriefGenerationJobStatus;
  attempt_count: number;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}): BriefGenerationJobRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contentHash: row.content_hash,
    presentationHash: row.presentation_hash,
    responseSchemaVersion: row.response_schema_version,
    requestId: row.request_id,
    status: row.status,
    attemptCount: row.attempt_count,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export async function enqueueBriefGenerationJob(
  prisma: PrismaClient,
  identity: BriefIdentity
): Promise<BriefGenerationJobRow> {
  const requestId = randomUUID();
  try {
    const row = await prisma.briefGenerationJob.create({
      data: {
        organization_id: identity.organizationId,
        content_hash: identity.contentHash,
        presentation_hash: identity.presentationHash,
        response_schema_version: identity.responseSchemaVersion,
        request_id: requestId,
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
            organization_id: identity.organizationId,
            content_hash: identity.contentHash,
            presentation_hash: identity.presentationHash,
            response_schema_version: identity.responseSchemaVersion,
          },
        },
      });
      return mapJob(existing);
    }
    throw error;
  }
}

export async function claimNextBriefGenerationJob(
  prisma: PrismaClient,
  input: { workerId: string; now: Date; env?: NodeJS.ProcessEnv }
): Promise<BriefGenerationJobRow | null> {
  const config = resolveBriefAsyncConfig(input.env);
  const leaseExpiresAt = new Date(input.now.getTime() + config.workerLeaseMs);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        organization_id: string;
        content_hash: string;
        presentation_hash: string;
        response_schema_version: string;
        request_id: string;
        status: BriefGenerationJobStatus;
        attempt_count: number;
        lease_owner: string | null;
        lease_expires_at: Date | null;
        created_at: Date;
        updated_at: Date;
        completed_at: Date | null;
      }>
    >(Prisma.sql`
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
  jobId: string,
  now: Date
): Promise<void> {
  await prisma.briefGenerationJob.update({
    where: { id: jobId },
    data: {
      status: BriefGenerationJobStatus.COMPLETED,
      completed_at: now,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
}

export async function expireBriefGenerationJob(
  prisma: PrismaClient,
  jobId: string
): Promise<void> {
  await prisma.briefGenerationJob.update({
    where: { id: jobId },
    data: {
      status: BriefGenerationJobStatus.EXPIRED,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
}

export async function failBriefGenerationJob(
  prisma: PrismaClient,
  jobId: string
): Promise<void> {
  await prisma.briefGenerationJob.update({
    where: { id: jobId },
    data: {
      status: BriefGenerationJobStatus.FAILED,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
}
