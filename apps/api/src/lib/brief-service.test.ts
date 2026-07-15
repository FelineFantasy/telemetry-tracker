import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import * as authz from "./brief-authz.js";
import * as completed from "./brief-completed.js";
import * as generationJob from "./brief-generation-job.js";
import * as orgSnapshot from "./brief-org-snapshot.js";
import {
  BRIEF_ASYNC_PENDING_UNAVAILABLE_REASON,
  getWorkspaceBrief,
} from "./brief-service.js";

const USER_ID = "f0000000-0000-4000-8000-000000000010";
const ORG_ID = "e0000000-0000-4000-8000-000000000005";
const PROJECT_ID = "a0000000-0000-4000-8000-000000000001";
const STORED_REQUEST_ID = "b0000000-0000-4000-8000-000000000099";

const builtSnapshot: BriefSnapshotRequest = {
  schemaVersion: "2026-07-brief-v1",
  requestId: "req-snapshot",
  generatedAt: "2026-07-14T12:34:00.000Z",
  organizationId: ORG_ID,
  viewer: {},
  projects: [
    {
      projectId: PROJECT_ID,
      projectName: "Alpha",
      projectSlug: "alpha",
      window: {
        since: "2026-07-07T12:34:00.000Z",
        until: "2026-07-14T12:34:00.000Z",
        previousSince: "2026-06-30T12:34:00.000Z",
        previousUntil: "2026-07-07T12:34:00.000Z",
        durationMs: 604_800_000,
      },
      kpis: {
        errors: { count: 1, previous: 0 },
        events: { count: 1, previous: 0 },
        sessions: { count: 1, previous: 0 },
        activeUsers: { count: 1, previous: 0 },
        errorRatePct: { value: 1, previous: 0 },
      },
      errorGroups: {
        firstSeenInWindow: [],
        byOccurrenceCount: [],
        byAbsoluteDelta: [],
      },
    },
  ],
};

const buildMeta = {
  truncated: false,
  truncationSteps: [] as string[],
  droppedProjectIds: [] as string[],
  byteLength: 100,
};

const storedBrief = {
  schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
  requestId: STORED_REQUEST_ID,
  generatedAt: "2026-07-14T12:34:00.000Z",
  workspace: { title: "Workspace brief" },
  projects: [
    {
      projectId: PROJECT_ID,
      generatedThrough: "2026-07-14T12:34:00.000Z",
      significance: "low" as const,
      collapsedLabel: "1 error",
    },
  ],
};

const prisma = {} as never;
const fixedNow = new Date("2026-07-14T12:34:15.789Z");

describe("getWorkspaceBrief (async read path)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(authz, "authorizeWorkspaceBrief").mockResolvedValue({
      ok: true,
      organizationId: ORG_ID,
      organizationName: "Acme Corp",
      projects: [
        {
          id: PROJECT_ID,
          name: "Alpha",
          slug: "alpha",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    vi.spyOn(orgSnapshot, "buildOrganizationBriefSnapshot").mockImplementation(
      async (_prisma, input) => ({
        ok: true,
        snapshot: { ...builtSnapshot, requestId: input.requestId },
        contentHash: "c".repeat(64),
        snapshotHash: "d".repeat(64),
        meta: buildMeta,
      })
    );

    vi.spyOn(completed, "findCurrentBriefCompleted").mockResolvedValue(null);
    vi.spyOn(completed, "findStaleBriefCompleted").mockResolvedValue(null);
    vi.spyOn(generationJob, "enqueueBriefGenerationJob").mockResolvedValue({
      id: "job-1",
      organizationId: ORG_ID,
      contentHash: "c".repeat(64),
      presentationHash: "p".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: "job-request",
      requestUntil: new Date("2026-07-14T12:34:00.000Z"),
      status: "PENDING",
      attemptCount: 0,
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      completedAt: null,
    });
  });

  it("forwards viewer timezone into the organization snapshot build", async () => {
    await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
      timezone: "Europe/Berlin",
    });

    expect(orgSnapshot.buildOrganizationBriefSnapshot).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        viewerTimezone: "Europe/Berlin",
      })
    );
  });

  it("uses bucketed requestUntil when building the organization snapshot", async () => {
    await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(orgSnapshot.buildOrganizationBriefSnapshot).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        organizationId: ORG_ID,
        requestUntil: new Date("2026-07-14T12:34:00.000Z"),
      })
    );
  });

  it("serves a current completed brief with stored requestId", async () => {
    vi.spyOn(completed, "findCurrentBriefCompleted").mockResolvedValue({
      id: "completed-1",
      organizationId: ORG_ID,
      contentHash: "c".repeat(64),
      presentationHash: "p".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: STORED_REQUEST_ID,
      snapshotHash: "d".repeat(64),
      brief: storedBrief,
      completedAt: fixedNow,
      expiresAt: new Date("2026-08-14T12:34:00.000Z"),
    });

    const result = await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.requestId).toBe(STORED_REQUEST_ID);
    expect(result.meta.source).toBe("ai");
    expect(generationJob.enqueueBriefGenerationJob).not.toHaveBeenCalled();
  });

  it("returns the same requestId across repeated reads of a completed brief", async () => {
    vi.spyOn(completed, "findCurrentBriefCompleted").mockResolvedValue({
      id: "completed-1",
      organizationId: ORG_ID,
      contentHash: "c".repeat(64),
      presentationHash: "p".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: STORED_REQUEST_ID,
      snapshotHash: "d".repeat(64),
      brief: storedBrief,
      completedAt: fixedNow,
      expiresAt: new Date("2026-08-14T12:34:00.000Z"),
    });

    const first = await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });
    const second = await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    if (first.status !== "ok" || second.status !== "ok") return;
    expect(first.requestId).toBe(STORED_REQUEST_ID);
    expect(second.requestId).toBe(STORED_REQUEST_ID);
  });

  it("serves a stale completed brief when current identity is missing", async () => {
    vi.spyOn(completed, "findStaleBriefCompleted").mockResolvedValue({
      id: "completed-stale",
      organizationId: ORG_ID,
      contentHash: "old".repeat(16),
      presentationHash: "p".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: STORED_REQUEST_ID,
      snapshotHash: "s".repeat(64),
      brief: storedBrief,
      completedAt: new Date("2026-07-10T12:00:00.000Z"),
      expiresAt: new Date("2026-08-10T12:00:00.000Z"),
    });

    const result = await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.meta.source).toBe("stale");
    expect(result.requestId).toBe(STORED_REQUEST_ID);
    expect(result.contentHash).toBe("old".repeat(16));
    expect(result.snapshotHash).toBe("s".repeat(64));
    expect(generationJob.enqueueBriefGenerationJob).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        organizationId: ORG_ID,
        requestUntil: new Date("2026-07-14T12:34:00.000Z"),
      })
    );
  });

  it("serves a completed brief when one appears between lookup and enqueue", async () => {
    const completedAfterRace = {
      id: "completed-race",
      organizationId: ORG_ID,
      contentHash: "c".repeat(64),
      presentationHash: "p".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: STORED_REQUEST_ID,
      snapshotHash: "d".repeat(64),
      brief: storedBrief,
      completedAt: fixedNow,
      expiresAt: new Date("2026-08-14T12:00:00.000Z"),
    };

    vi.spyOn(completed, "findCurrentBriefCompleted")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(completedAfterRace);

    const result = await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.requestId).toBe(STORED_REQUEST_ID);
    expect(result.meta.source).toBe("ai");
  });

  it("enqueues a job and returns factual fallback when no completed brief exists", async () => {
    const result = await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.requestId).toBe("job-request");
    expect(result.reason).toBe(BRIEF_ASYNC_PENDING_UNAVAILABLE_REASON);
    expect(generationJob.enqueueBriefGenerationJob).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        requestUntil: new Date("2026-07-14T12:34:00.000Z"),
      })
    );
    expect(result.fallback.schemaVersion).toBe("2026-07-brief-fallback-v1");
  });

  it("returns HTTP 422 for snapshot_too_large", async () => {
    vi.spyOn(orgSnapshot, "buildOrganizationBriefSnapshot").mockResolvedValue({
      ok: false,
      code: "snapshot_too_large",
      truncationSteps: ["drop_project"],
      droppedProjectIds: ["b0000000-0000-4000-8000-000000000002"],
      byteLength: 300_000,
    });

    const result = await getWorkspaceBrief({ prisma, now: () => fixedNow }, {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.httpStatus).toBe(422);
    expect(result.code).toBe("snapshot_too_large");
  });
});
