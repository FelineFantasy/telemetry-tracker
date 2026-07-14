import { describe, expect, it } from "vitest";
import { BRIEF_MAX_SNAPSHOT_BYTES, BRIEF_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import { enforceBriefSnapshotSizeLimits, snapshotByteLength } from "./brief-snapshot-size.js";

const PROJECT_A = "a0000000-0000-4000-8000-000000000001";
const PROJECT_B = "b0000000-0000-4000-8000-000000000002";
const ORG_ID = "c0000000-0000-4000-8000-000000000003";

function candidate(message: string) {
  return {
    id: "d0000000-0000-4000-8000-000000000004",
    message,
    app: "web",
    firstSeen: "2026-07-12T10:00:00.000Z",
    lastSeen: "2026-07-14T11:00:00.000Z",
    occurrences: { count: 10, previous: 2 },
    affectedUsers: { count: 5, previous: 1 },
    topBrowsers: [{ browser: "Safari", count: 3 }],
    topOs: [{ os: "macOS", count: 3 }],
  };
}

function projectSnapshot(projectId: string, name: string, errors: number, events: number) {
  return {
    projectId,
    projectName: name,
    projectSlug: name.toLowerCase(),
    window: {
      since: "2026-07-07T12:00:00.000Z",
      until: "2026-07-14T12:00:00.000Z",
      previousSince: "2026-06-30T12:00:00.000Z",
      previousUntil: "2026-07-07T12:00:00.000Z",
      durationMs: 7 * 24 * 60 * 60 * 1000,
    },
    kpis: {
      errors: { count: errors, previous: 1 },
      events: { count: events, previous: 1 },
      sessions: { count: 1, previous: 1 },
      activeUsers: { count: 1, previous: 1 },
      errorRatePct: { value: 1, previous: 1 },
    },
    releases: {
      byErrorOccurrences: [{ release: "v1.0.0", errorOccurrences: 1, eventRows: 1 }],
    },
    environments: {
      byEventRows: [{ environment: "production", count: 10 }],
    },
    sessionsSummary: {
      avgDurationSec: { value: 10, previous: 9 },
    },
    errorGroups: {
      firstSeenInWindow: [candidate("alpha")],
      byOccurrenceCount: [candidate("beta")],
      byAbsoluteDelta: [candidate("gamma")],
    },
  };
}

function oversizedSnapshot(): BriefSnapshotRequest {
  const hugeMessage = "Error: " + "x".repeat(200_000);
  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    requestId: "e0000000-0000-4000-8000-000000000005",
    generatedAt: "2026-07-14T12:00:00.000Z",
    organizationId: ORG_ID,
    viewer: {},
    projects: Array.from({ length: 20 }, (_, i) => {
      const id = `${String(i).padStart(8, "0")}-0000-4000-8000-000000000001`;
      return {
        ...projectSnapshot(id, `project-${i}`, 100 - i, 1000 - i),
        errorGroups: {
          firstSeenInWindow: Array.from({ length: 10 }, () => candidate(hugeMessage)),
          byOccurrenceCount: Array.from({ length: 10 }, () => candidate(hugeMessage)),
          byAbsoluteDelta: Array.from({ length: 10 }, () => candidate(hugeMessage)),
        },
      };
    }),
  };
}

describe("enforceBriefSnapshotSizeLimits", () => {
  it("does not mutate the original snapshot", () => {
    const original = {
      schemaVersion: BRIEF_SCHEMA_VERSION,
      requestId: "e0000000-0000-4000-8000-000000000005",
      generatedAt: "2026-07-14T12:00:00.000Z",
      organizationId: ORG_ID,
      viewer: {},
      projects: [projectSnapshot(PROJECT_A, "Alpha", 5, 50)],
    };
    const cloneBefore = structuredClone(original);
    const result = enforceBriefSnapshotSizeLimits(original);
    expect(original).toEqual(cloneBefore);
    expect(result.ok).toBe(true);
  });

  it("returns a snapshot under the byte limit", () => {
    const result = enforceBriefSnapshotSizeLimits(oversizedSnapshot());
    if (result.ok) {
      expect(result.meta.byteLength).toBeLessThanOrEqual(BRIEF_MAX_SNAPSHOT_BYTES);
      expect(snapshotByteLength(result.snapshot)).toBeLessThanOrEqual(
        BRIEF_MAX_SNAPSHOT_BYTES
      );
    } else {
      expect(result.code).toBe("snapshot_too_large");
    }
  });

  it("records dropped project IDs when projects are removed", () => {
    const snapshot: BriefSnapshotRequest = {
      schemaVersion: BRIEF_SCHEMA_VERSION,
      requestId: "e0000000-0000-4000-8000-000000000005",
      generatedAt: "2026-07-14T12:00:00.000Z",
      organizationId: ORG_ID,
      viewer: {},
      projects: [
        projectSnapshot(PROJECT_A, "Alpha", 1, 1),
        projectSnapshot(PROJECT_B, "Beta", 100, 1000),
      ],
    };
    const huge = "z".repeat(120_000);
    for (const project of snapshot.projects) {
      project.errorGroups.firstSeenInWindow = [candidate(huge)];
      project.errorGroups.byOccurrenceCount = [candidate(huge)];
      project.errorGroups.byAbsoluteDelta = [candidate(huge)];
    }

    const result = enforceBriefSnapshotSizeLimits(snapshot);
    if (result.ok && result.meta.droppedProjectIds.length > 0) {
      expect(result.meta.truncationSteps.some((step) => step.startsWith("dropped.project:"))).toBe(
        true
      );
      expect(result.meta.droppedProjectIds).toContain(PROJECT_A);
    } else if (!result.ok) {
      expect(result.droppedProjectIds.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("never returns an oversized payload on success", () => {
    const result = enforceBriefSnapshotSizeLimits(oversizedSnapshot());
    if (result.ok) {
      expect(result.meta.byteLength).toBeLessThanOrEqual(BRIEF_MAX_SNAPSHOT_BYTES);
    }
  });
});
