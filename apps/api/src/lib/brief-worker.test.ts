import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import * as briefClient from "./brief-client.js";
import * as completed from "./brief-completed.js";
import * as generationJob from "./brief-generation-job.js";
import * as orgSnapshot from "./brief-org-snapshot.js";
import * as presentationHash from "./brief-presentation-hash.js";
import { processNextBriefGenerationJob } from "./brief-worker.js";

const ORG_ID = "e0000000-0000-4000-8000-000000000005";
const PROJECT_ID = "a0000000-0000-4000-8000-000000000001";
const JOB_ID = "d0000000-0000-4000-8000-000000000007";
const REQUEST_ID = "b0000000-0000-4000-8000-000000000099";
const REQUEST_UNTIL = new Date("2026-07-14T12:34:00.000Z");
const CONTENT_HASH = "c".repeat(64);
const PRESENTATION_HASH = "p".repeat(64);
const WORKER_ID = "worker-test";

const builtSnapshot = {
  schemaVersion: "2026-07-brief-v1",
  requestId: REQUEST_ID,
  generatedAt: REQUEST_UNTIL.toISOString(),
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

describe("processNextBriefGenerationJob", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(generationJob, "claimNextBriefGenerationJob").mockResolvedValue({
      id: JOB_ID,
      organizationId: ORG_ID,
      contentHash: CONTENT_HASH,
      presentationHash: PRESENTATION_HASH,
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: REQUEST_ID,
      requestUntil: REQUEST_UNTIL,
      status: "PROCESSING",
      attemptCount: 1,
      leaseOwner: WORKER_ID,
      leaseExpiresAt: new Date("2026-07-14T13:34:00.000Z"),
      createdAt: REQUEST_UNTIL,
      updatedAt: REQUEST_UNTIL,
      completedAt: null,
    });

    vi.spyOn(orgSnapshot, "loadOrganizationBriefContext").mockResolvedValue({
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

    vi.spyOn(orgSnapshot, "buildOrganizationBriefSnapshot").mockResolvedValue({
      ok: true,
      snapshot: builtSnapshot,
      contentHash: CONTENT_HASH,
      snapshotHash: "s".repeat(64),
      meta: {
        truncated: false,
        truncationSteps: [],
        droppedProjectIds: [],
        byteLength: 100,
      },
    });

    vi.spyOn(presentationHash, "computePresentationHash").mockReturnValue(PRESENTATION_HASH);

    vi.spyOn(generationJob, "completeBriefGenerationJob").mockResolvedValue(true);
    vi.spyOn(briefClient, "postWorkspaceBrief");
  });

  it("completes the job without calling AI when BriefCompleted already exists", async () => {
    vi.spyOn(completed, "findCurrentBriefCompleted").mockResolvedValue({
      id: "completed-1",
      organizationId: ORG_ID,
      contentHash: CONTENT_HASH,
      presentationHash: PRESENTATION_HASH,
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: REQUEST_ID,
      snapshotHash: "s".repeat(64),
      brief: {
        schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
        requestId: REQUEST_ID,
        generatedAt: REQUEST_UNTIL.toISOString(),
        workspace: { title: "Brief" },
        projects: [
          {
            projectId: PROJECT_ID,
            generatedThrough: REQUEST_UNTIL.toISOString(),
            significance: "low" as const,
            collapsedLabel: "1 error",
          },
        ],
      },
      completedAt: REQUEST_UNTIL,
      expiresAt: new Date("2026-08-14T12:00:00.000Z"),
    });

    const result = await processNextBriefGenerationJob({
      prisma: {} as never,
      workerId: WORKER_ID,
      now: () => REQUEST_UNTIL,
    });

    expect(result).toEqual({
      status: "completed",
      jobId: JOB_ID,
      requestId: REQUEST_ID,
    });
    expect(briefClient.postWorkspaceBrief).not.toHaveBeenCalled();
    expect(generationJob.completeBriefGenerationJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ jobId: JOB_ID, workerId: WORKER_ID })
    );
  });
});
