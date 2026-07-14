import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { BRIEF_MAX_SNAPSHOT_BYTES, BRIEF_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefBatchData } from "./brief-snapshot-batch.js";
import { computeContentHash, computeSnapshotHash } from "./brief-snapshot-hash.js";
import {
  buildWorkspaceBriefSnapshot,
  measureSnapshotBytes,
} from "./brief-snapshot.js";

const PROJECT_A = "a0000000-0000-4000-8000-000000000001";
const PROJECT_B = "b0000000-0000-4000-8000-000000000002";
const ORG_ID = "c0000000-0000-4000-8000-000000000003";
const USER_ID = "d0000000-0000-4000-8000-000000000004";
const REQUEST_ID = "e0000000-0000-4000-8000-000000000005";
const ERROR_GROUP_A = "f0000000-0000-4000-8000-000000000006";
const ERROR_GROUP_B = "f0000000-0000-4000-8000-000000000007";

const requestUntil = new Date("2026-07-14T12:00:00.000Z");
const projectCreatedAt = new Date("2026-01-01T00:00:00.000Z");

vi.mock("./brief-ack.js", () => ({
  loadBriefAcknowledgements: vi.fn(async () => new Map()),
}));

vi.mock("./brief-snapshot-batch.js", () => ({
  fetchBriefBatchData: vi.fn(),
}));

import { loadBriefAcknowledgements } from "./brief-ack.js";
import { fetchBriefBatchData } from "./brief-snapshot-batch.js";

function emptyBatch(): BriefBatchData {
  return {
    kpis: new Map(),
    sessionsSummary: new Map(),
    firstSeenInWindow: new Map(),
    byOccurrenceCount: new Map(),
    byAbsoluteDelta: new Map(),
    candidateMetrics: new Map(),
    topBrowsers: new Map(),
    topOs: new Map(),
    releases: new Map(),
    environments: new Map(),
  };
}

function batchForProjects(projectIds: string[]): BriefBatchData {
  const batch = emptyBatch();
  for (const projectId of projectIds) {
    batch.kpis.set(projectId, {
      errors: { count: 10, previous: 5 },
      events: { count: 100, previous: 80 },
      sessions: { count: 20, previous: 15 },
      activeUsers: { count: 12, previous: 10 },
      errorRatePct: { value: 9.09, previous: 5.88 },
    });
    batch.firstSeenInWindow.set(projectId, [
      {
        projectId,
        id: projectId === PROJECT_A ? ERROR_GROUP_A : ERROR_GROUP_B,
        message: "TypeError: boom",
        app: "web",
        environment: "production",
        release: "1.0.0",
        firstSeen: new Date("2026-07-13T10:00:00.000Z"),
        lastSeen: new Date("2026-07-14T11:00:00.000Z"),
      },
    ]);
    batch.byOccurrenceCount.set(projectId, []);
    batch.byAbsoluteDelta.set(projectId, []);
    batch.candidateMetrics.set(projectId === PROJECT_A ? ERROR_GROUP_A : ERROR_GROUP_B, {
      occurrences: { count: 10, previous: 2 },
      affectedUsers: { count: 4, previous: 1 },
    });
    batch.releases.set(projectId, [
      {
        projectId,
        release: "1.0.0",
        errorOccurrences: 10,
        eventRows: 100,
      },
    ]);
    batch.environments.set(projectId, [
      { projectId, environment: "production", count: 90 },
      { projectId, environment: "staging", count: 10 },
    ]);
    batch.sessionsSummary.set(projectId, {
      avgDurationSec: { value: 42, previous: 40 },
    });
  }
  return batch;
}

const prisma = {} as PrismaClient;

describe("buildWorkspaceBriefSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadBriefAcknowledgements).mockResolvedValue(new Map());
    vi.mocked(fetchBriefBatchData).mockImplementation(async (_prisma, windows) =>
      batchForProjects(windows.map((w) => w.projectId))
    );
  });

  it("returns no_projects when the input list is empty", async () => {
    const result = await buildWorkspaceBriefSnapshot(prisma, {
      organizationId: ORG_ID,
      requestId: REQUEST_ID,
      requestUntil,
      userId: USER_ID,
      projects: [],
    });
    expect(result).toEqual({ ok: false, code: "no_projects" });
  });

  it("preserves requestId in the transmitted snapshot", async () => {
    const result = await buildWorkspaceBriefSnapshot(prisma, {
      organizationId: ORG_ID,
      requestId: REQUEST_ID,
      requestUntil,
      userId: USER_ID,
      projects: [
        {
          id: PROJECT_A,
          name: "Alpha",
          slug: "alpha",
          createdAt: projectCreatedAt,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.requestId).toBe(REQUEST_ID);
    }
  });

  it("sorts projects by projectId regardless of input order", async () => {
    const result = await buildWorkspaceBriefSnapshot(prisma, {
      organizationId: ORG_ID,
      requestId: REQUEST_ID,
      requestUntil,
      userId: USER_ID,
      projects: [
        {
          id: PROJECT_B,
          name: "Beta",
          slug: "beta",
          createdAt: projectCreatedAt,
        },
        {
          id: PROJECT_A,
          name: "Alpha",
          slug: "alpha",
          createdAt: projectCreatedAt,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.projects.map((p) => p.projectId)).toEqual([
        PROJECT_A,
        PROJECT_B,
      ]);
    }
  });

  it("includes environment distribution instead of primaryEnvironment", async () => {
    const result = await buildWorkspaceBriefSnapshot(prisma, {
      organizationId: ORG_ID,
      requestId: REQUEST_ID,
      requestUntil,
      userId: USER_ID,
      projects: [
        {
          id: PROJECT_A,
          name: "Alpha",
          slug: "alpha",
          createdAt: projectCreatedAt,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.projects[0]!.environments).toEqual({
        byEventRows: [
          { environment: "production", count: 90 },
          { environment: "staging", count: 10 },
        ],
      });
      expect(
        "primaryEnvironment" in (result.snapshot.projects[0] as Record<string, unknown>)
      ).toBe(false);
    }
  });

  it("computes stable contentHash and snapshotHash for identical factual input", async () => {
    const input = {
      organizationId: ORG_ID,
      requestId: REQUEST_ID,
      requestUntil,
      userId: USER_ID,
      projects: [
        {
          id: PROJECT_A,
          name: "Alpha",
          slug: "alpha",
          createdAt: projectCreatedAt,
        },
      ],
    };
    const first = await buildWorkspaceBriefSnapshot(prisma, input);
    const second = await buildWorkspaceBriefSnapshot(prisma, {
      ...input,
      requestId: "00000000-0000-4000-8000-000000000099",
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.contentHash).toBe(second.contentHash);
      expect(first.snapshotHash).toBe(second.snapshotHash);
      expect(first.contentHash).toBe(computeContentHash(first.snapshot));
      expect(first.snapshotHash).toBe(computeSnapshotHash(first.snapshot));
    }
  });

  it("sanitizes sensitive text in candidate messages", async () => {
    vi.mocked(fetchBriefBatchData).mockImplementation(async (_prisma, windows) => {
      const batch = batchForProjects(windows.map((w) => w.projectId));
      const list = batch.firstSeenInWindow.get(PROJECT_A)!;
      list[0]!.message = "Failed for user@example.com with token=abc";
      return batch;
    });

    const result = await buildWorkspaceBriefSnapshot(prisma, {
      organizationId: ORG_ID,
      requestId: REQUEST_ID,
      requestUntil,
      userId: USER_ID,
      projects: [
        {
          id: PROJECT_A,
          name: "Alpha",
          slug: "alpha",
          createdAt: projectCreatedAt,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.projects[0]!.errorGroups.firstSeenInWindow[0]!.message).toBe(
        "Failed for [email] with token=[redacted]"
      );
    }
  });

  it("returns a snapshot under the hard byte limit", async () => {
    const result = await buildWorkspaceBriefSnapshot(prisma, {
      organizationId: ORG_ID,
      requestId: REQUEST_ID,
      requestUntil,
      userId: USER_ID,
      projects: [
        {
          id: PROJECT_A,
          name: "Alpha",
          slug: "alpha",
          createdAt: projectCreatedAt,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(measureSnapshotBytes(result.snapshot)).toBeLessThanOrEqual(
        BRIEF_MAX_SNAPSHOT_BYTES
      );
      expect(result.meta.byteLength).toBeLessThanOrEqual(BRIEF_MAX_SNAPSHOT_BYTES);
      expect(result.snapshot.schemaVersion).toBe(BRIEF_SCHEMA_VERSION);
    }
  });
});
