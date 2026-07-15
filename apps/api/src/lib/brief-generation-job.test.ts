import { beforeEach, describe, expect, it, vi } from "vitest";
import { BriefGenerationJobStatus, Prisma } from "@prisma/client";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import * as completed from "./brief-completed.js";
import { enqueueBriefGenerationJob } from "./brief-generation-job.js";

const ORG_ID = "e0000000-0000-4000-8000-000000000005";
const REQUEST_UNTIL = new Date("2026-07-14T12:34:00.000Z");
const INPUT = {
  organizationId: ORG_ID,
  contentHash: "c".repeat(64),
  presentationHash: "p".repeat(64),
  responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
  requestUntil: REQUEST_UNTIL,
};

function existingJob(overrides: Partial<{
  id: string;
  status: BriefGenerationJobStatus;
  request_id: string;
}> = {}) {
  return {
    id: overrides.id ?? "job-1",
    organization_id: ORG_ID,
    content_hash: INPUT.contentHash,
    presentation_hash: INPUT.presentationHash,
    response_schema_version: INPUT.responseSchemaVersion,
    request_id: overrides.request_id ?? "req-existing",
    request_until: REQUEST_UNTIL,
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

  it("resets FAILED jobs to PENDING with a new requestId and requestUntil", async () => {
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

    const result = await enqueueBriefGenerationJob(prisma, INPUT);

    expect(update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: BriefGenerationJobStatus.PENDING,
        request_id: expect.any(String),
        request_until: REQUEST_UNTIL,
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

    const result = await enqueueBriefGenerationJob(prisma, INPUT);

    expect(update).not.toHaveBeenCalled();
    expect(result.status).toBe(BriefGenerationJobStatus.PROCESSING);
  });

  it("resets COMPLETED jobs when the matching BriefCompleted row is missing", async () => {
    vi.spyOn(completed, "findCurrentBriefCompleted").mockResolvedValue(null);
    const update = vi.fn().mockResolvedValue(
      existingJob({ status: BriefGenerationJobStatus.PENDING, request_id: "req-new" })
    );
    const findUniqueOrThrow = vi.fn().mockResolvedValue(
      existingJob({ status: BriefGenerationJobStatus.COMPLETED })
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

    const result = await enqueueBriefGenerationJob(prisma, INPUT);

    expect(update).toHaveBeenCalled();
    expect(result.status).toBe(BriefGenerationJobStatus.PENDING);
  });

  it("returns COMPLETED jobs when the matching BriefCompleted row exists", async () => {
    vi.spyOn(completed, "findCurrentBriefCompleted").mockResolvedValue({
      id: "completed-1",
      organizationId: ORG_ID,
      contentHash: INPUT.contentHash,
      presentationHash: INPUT.presentationHash,
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: "req-existing",
      snapshotHash: "d".repeat(64),
      brief: {
        schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
        requestId: "req-existing",
        generatedAt: REQUEST_UNTIL.toISOString(),
        workspace: { title: "Brief" },
        projects: [
          {
            projectId: "a0000000-0000-4000-8000-000000000001",
            generatedThrough: REQUEST_UNTIL.toISOString(),
            significance: "none" as const,
            collapsedLabel: "No changes",
          },
        ],
      },
      completedAt: REQUEST_UNTIL,
      expiresAt: new Date("2026-08-14T12:00:00.000Z"),
    });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(
      existingJob({ status: BriefGenerationJobStatus.COMPLETED })
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

    const result = await enqueueBriefGenerationJob(prisma, INPUT);

    expect(update).not.toHaveBeenCalled();
    expect(result.status).toBe(BriefGenerationJobStatus.COMPLETED);
  });
});
