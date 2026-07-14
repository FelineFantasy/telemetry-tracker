import { describe, expect, it } from "vitest";
import { BRIEF_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import {
  computeContentHash,
  computeSnapshotHash,
  reorderObjectKeys,
  stableStringify,
} from "./brief-snapshot-hash.js";

const PROJECT_A = "a0000000-0000-4000-8000-000000000001";
const PROJECT_B = "b0000000-0000-4000-8000-000000000002";
const ORG_ID = "c0000000-0000-4000-8000-000000000003";
const REQUEST_A = "d0000000-0000-4000-8000-000000000004";
const REQUEST_B = "e0000000-0000-4000-8000-000000000005";

function baseSnapshot(requestId: string): BriefSnapshotRequest {
  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    requestId,
    generatedAt: "2026-07-14T12:00:00.000Z",
    organizationId: ORG_ID,
    viewer: { timezone: "Europe/Berlin" },
    projects: [
      {
        projectId: PROJECT_A,
        projectName: "Alpha",
        projectSlug: "alpha",
        window: {
          since: "2026-07-07T12:00:00.000Z",
          until: "2026-07-14T12:00:00.000Z",
          previousSince: "2026-06-30T12:00:00.000Z",
          previousUntil: "2026-07-07T12:00:00.000Z",
          durationMs: 7 * 24 * 60 * 60 * 1000,
        },
        kpis: {
          errors: { count: 10, previous: 8 },
          events: { count: 100, previous: 90 },
          sessions: { count: 20, previous: 18 },
          activeUsers: { count: 15, previous: 12 },
          errorRatePct: { value: 9.09, previous: 8.16 },
        },
        errorGroups: {
          firstSeenInWindow: [],
          byOccurrenceCount: [],
          byAbsoluteDelta: [],
        },
      },
    ],
  };
}

describe("stableStringify", () => {
  it("is insensitive to object key insertion order", () => {
    const a = { z: 1, a: 2, m: { y: 1, b: 2 } };
    const b = reorderObjectKeys(a);
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});

describe("computeContentHash", () => {
  it("ignores requestId differences", () => {
    const a = baseSnapshot(REQUEST_A);
    const b = baseSnapshot(REQUEST_B);
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("ignores projectName and projectSlug differences", () => {
    const a = baseSnapshot(REQUEST_A);
    const b = baseSnapshot(REQUEST_A);
    b.projects[0]!.projectName = "Renamed";
    b.projects[0]!.projectSlug = "renamed";
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("changes when telemetry facts change", () => {
    const a = baseSnapshot(REQUEST_A);
    const b = baseSnapshot(REQUEST_A);
    b.projects[0]!.kpis.errors.count = 99;
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });

  it("changes when served windows change", () => {
    const a = baseSnapshot(REQUEST_A);
    const b = baseSnapshot(REQUEST_A);
    b.projects[0]!.window.until = "2026-07-14T13:00:00.000Z";
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });
});

describe("computeSnapshotHash", () => {
  it("ignores requestId differences", () => {
    const a = baseSnapshot(REQUEST_A);
    const b = baseSnapshot(REQUEST_B);
    expect(computeSnapshotHash(a)).toBe(computeSnapshotHash(b));
  });

  it("changes when project metadata changes", () => {
    const a = baseSnapshot(REQUEST_A);
    const b = baseSnapshot(REQUEST_A);
    b.projects[0]!.projectName = "Renamed";
    expect(computeSnapshotHash(a)).not.toBe(computeSnapshotHash(b));
  });

  it("changes when served windows change", () => {
    const a = baseSnapshot(REQUEST_A);
    const b = baseSnapshot(REQUEST_A);
    b.projects[0]!.window.until = "2026-07-14T13:00:00.000Z";
    expect(computeSnapshotHash(a)).not.toBe(computeSnapshotHash(b));
  });

  it("returns 64-char lowercase hex", () => {
    expect(computeSnapshotHash(baseSnapshot(REQUEST_A))).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("hash separation", () => {
  it("can differ between contentHash and snapshotHash when metadata differs", () => {
    const contentOnlyChange = baseSnapshot(REQUEST_A);
    contentOnlyChange.projects[0]!.projectName = "Different label";
    const contentHash = computeContentHash(contentOnlyChange);
    const snapshotHash = computeSnapshotHash(contentOnlyChange);
    expect(contentHash).not.toBe(snapshotHash);
  });

  it("matches across two projects sorted by projectId", () => {
    const snapshot = baseSnapshot(REQUEST_A);
    snapshot.projects.push({
      ...snapshot.projects[0]!,
      projectId: PROJECT_B,
      projectName: "Beta",
      projectSlug: "beta",
    });
    snapshot.projects.sort((a, b) => a.projectId.localeCompare(b.projectId));
    expect(computeContentHash(snapshot)).toMatch(/^[a-f0-9]{64}$/);
  });
});
