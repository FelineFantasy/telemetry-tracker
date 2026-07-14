import { describe, expect, it } from "vitest";
import { buildWorkspaceBriefFallback } from "./brief-fallback.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";

const snapshot: BriefSnapshotRequest = {
  schemaVersion: "2026-07-brief-v1",
  requestId: "b0000000-0000-4000-8000-000000000003",
  generatedAt: "2026-07-14T12:34:00.000Z",
  organizationId: "c0000000-0000-4000-8000-000000000004",
  viewer: {},
  projects: [
    {
      projectId: "a0000000-0000-4000-8000-000000000001",
      projectName: "Acme",
      projectSlug: "acme",
      window: {
        since: "2026-07-07T12:34:00.000Z",
        until: "2026-07-14T12:34:00.000Z",
        previousSince: "2026-06-30T12:34:00.000Z",
        previousUntil: "2026-07-07T12:34:00.000Z",
        durationMs: 604_800_000,
      },
      kpis: {
        errors: { count: 5, previous: 3 },
        events: { count: 100, previous: 90 },
        sessions: { count: 20, previous: 18 },
        activeUsers: { count: 10, previous: 9 },
        errorRatePct: { value: 0.5, previous: 0.4 },
      },
      errorGroups: {
        firstSeenInWindow: [],
        byOccurrenceCount: [],
        byAbsoluteDelta: [],
      },
    },
  ],
};

describe("buildWorkspaceBriefFallback", () => {
  it("returns factual counts only", () => {
    const fallback = buildWorkspaceBriefFallback(
      snapshot,
      "req-1",
      new Date("2026-07-14T12:34:10.000Z")
    );
    expect(fallback.schemaVersion).toBe("2026-07-brief-fallback-v1");
    expect(fallback.projects[0]!.facts.some((f) => f.kind === "error_count")).toBe(true);
    expect(JSON.stringify(fallback)).not.toContain("significance");
  });
});
