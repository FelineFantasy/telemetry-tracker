import { beforeEach, describe, expect, it, vi } from "vitest";
import { BriefGenerationJobStatus, Prisma } from "@prisma/client";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import { enqueueBriefGenerationJob } from "./brief-generation-job.js";

const ORG_ID = "e0000000-0000-4000-8000-000000000005";
const IDENTITY = {
  organizationId: ORG_ID,
  contentHash: "c".repeat(64),
  presentationHash: "p".repeat(64),
  responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
};

function existingJob(overrides: Partial<{
  id: string;
  status: BriefGenerationJobStatus;
  request_id: string;
}> = {}) {
  return {
    id: overrides.id ?? "job-1",
    organization_id: ORG_ID,
    content_hash: IDENTITY.contentHash,
    presentation_hash: IDENTITY.presentationHash,
    response_schema_version: IDENTITY.responseSchemaVersion,
    request_id: overrides.request_id ?? "req-existing",
    status: overrides.status ?? BriefGenerationJobStatus.FAILED,
    attempt_count: 1,
    lease_owner: null,
    lease_expires_at: null,
    created_at: new Date("2026-07-14T12:00:00.000Z"),
    updated_at: new Date("2026-07-14T12:00:00.000Z"),
    completed_at: null,
  };
}

describe("enqueueBriefGenerationJob", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resets FAILED jobs to PENDING with a new requestId", async () => {
    const update = vi.fn().mockResolvedValue(
      existingJob({ status: BriefGenerationJobStatus.PENDING, request_id: "req-new" })
    );
    const findUniqueOrThrow = vi.fn().mockResolvedValue(
      existingJob({ status: BriefGenerationJobStatus.FAILED })
    );

    const prisma = {
      briefGenerationJob: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "test",
          })
        ),
        findUniqueOrThrow,
        update,
      },
    } as never;

    const result = await enqueueBriefGenerationJob(prisma, IDENTITY);

    expect(update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: BriefGenerationJobStatus.PENDING,
        request_id: expect.any(String),
        lease_owner: null,
        lease_expires_at: null,
        completed_at: null,
      },
    });
    expect(result.status).toBe(BriefGenerationJobStatus.PENDING);
    expect(result.requestId).toBe("req-new");
  });

  it("returns in-flight jobs without resetting them", async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue(
      existingJob({ status: BriefGenerationJobStatus.PROCESSING })
    );
    const update = vi.fn();

    const prisma = {
      briefGenerationJob: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "test",
          })
        ),
        findUniqueOrThrow,
        update,
      },
    } as never;

    const result = await enqueueBriefGenerationJob(prisma, IDENTITY);

    expect(update).not.toHaveBeenCalled();
    expect(result.status).toBe(BriefGenerationJobStatus.PROCESSING);
  });
});
