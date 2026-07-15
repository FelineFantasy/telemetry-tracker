import type { Prisma, PrismaClient } from "@prisma/client";
import type { WorkspaceBriefResponse } from "./brief-contracts.js";
import { parseWorkspaceBriefResponse } from "./brief-contracts.js";
import { resolveBriefAsyncConfig } from "./brief-async-config.js";

export type BriefIdentity = {
  organizationId: string;
  contentHash: string;
  presentationHash: string;
  responseSchemaVersion: string;
};

export type BriefCompletedRow = {
  id: string;
  organizationId: string;
  contentHash: string;
  presentationHash: string;
  responseSchemaVersion: string;
  requestId: string;
  snapshotHash: string;
  brief: WorkspaceBriefResponse;
  completedAt: Date;
  expiresAt: Date;
};

function mapRow(row: {
  id: string;
  organization_id: string;
  content_hash: string;
  presentation_hash: string;
  response_schema_version: string;
  request_id: string;
  snapshot_hash: string;
  brief_json: Prisma.JsonValue;
  completed_at: Date;
  expires_at: Date;
}): BriefCompletedRow | null {
  const parsed = parseWorkspaceBriefResponse(row.brief_json);
  if (!parsed.ok) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    contentHash: row.content_hash,
    presentationHash: row.presentation_hash,
    responseSchemaVersion: row.response_schema_version,
    requestId: row.request_id,
    snapshotHash: row.snapshot_hash,
    brief: parsed.data,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
  };
}

export async function findCurrentBriefCompleted(
  prisma: PrismaClient,
  identity: BriefIdentity,
  now: Date
): Promise<BriefCompletedRow | null> {
  const row = await prisma.briefCompleted.findUnique({
    where: {
      organization_id_content_hash_presentation_hash_response_schema_version: {
        organization_id: identity.organizationId,
        content_hash: identity.contentHash,
        presentation_hash: identity.presentationHash,
        response_schema_version: identity.responseSchemaVersion,
      },
    },
  });
  if (!row) return null;
  const mapped = mapRow(row);
  if (!mapped) return null;
  if (mapped.expiresAt <= now) return null;
  return mapped;
}

export async function findStaleBriefCompleted(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    excludeIdentity: BriefIdentity;
    now: Date;
    env?: NodeJS.ProcessEnv;
  }
): Promise<BriefCompletedRow | null> {
  const config = resolveBriefAsyncConfig(input.env);
  const staleCutoff = new Date(
    input.now.getTime() - config.staleMaxDisplayDays * 24 * 60 * 60 * 1000
  );

  const rows = await prisma.briefCompleted.findMany({
    where: {
      organization_id: input.organizationId,
      completed_at: { gte: staleCutoff },
      expires_at: { gt: input.now },
      NOT: {
        AND: [
          { content_hash: input.excludeIdentity.contentHash },
          { presentation_hash: input.excludeIdentity.presentationHash },
          { response_schema_version: input.excludeIdentity.responseSchemaVersion },
        ],
      },
    },
    orderBy: { completed_at: "desc" },
  });

  for (const row of rows) {
    const mapped = mapRow(row);
    if (mapped) return mapped;
  }

  return null;
}

export async function upsertBriefCompleted(
  prisma: PrismaClient,
  input: {
    identity: BriefIdentity;
    requestId: string;
    snapshotHash: string;
    brief: WorkspaceBriefResponse;
    now: Date;
    env?: NodeJS.ProcessEnv;
  }
): Promise<BriefCompletedRow> {
  const config = resolveBriefAsyncConfig(input.env);
  const expiresAt = new Date(
    input.now.getTime() + config.completedRetentionDays * 24 * 60 * 60 * 1000
  );

  const row = await prisma.briefCompleted.upsert({
    where: {
      organization_id_content_hash_presentation_hash_response_schema_version: {
        organization_id: input.identity.organizationId,
        content_hash: input.identity.contentHash,
        presentation_hash: input.identity.presentationHash,
        response_schema_version: input.identity.responseSchemaVersion,
      },
    },
    create: {
      organization_id: input.identity.organizationId,
      content_hash: input.identity.contentHash,
      presentation_hash: input.identity.presentationHash,
      response_schema_version: input.identity.responseSchemaVersion,
      request_id: input.requestId,
      snapshot_hash: input.snapshotHash,
      brief_json: input.brief as Prisma.InputJsonValue,
      completed_at: input.now,
      expires_at: expiresAt,
    },
    update: {
      request_id: input.requestId,
      snapshot_hash: input.snapshotHash,
      brief_json: input.brief as Prisma.InputJsonValue,
      completed_at: input.now,
      expires_at: expiresAt,
    },
  });

  const mapped = mapRow(row);
  if (!mapped) {
    throw new Error("Persisted brief failed response validation");
  }
  return mapped;
}
