import { describe, expect, it } from "vitest";
import { BRIEF_RESPONSE_SCHEMA_VERSION, BRIEF_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import { validatePrivateBriefResponse } from "./brief-validate-response.js";

const REQUEST_ID = "c0000000-0000-4000-8000-000000000003";
const PROJECT_A = "a0000000-0000-4000-8000-000000000001";

function snapshot(): BriefSnapshotRequest {
  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    requestId: REQUEST_ID,
    generatedAt: "2026-07-14T12:00:00.000Z",
    organizationId: "e0000000-0000-4000-8000-000000000005",
    viewer: {},
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
          durationMs: 604800000,
        },
        kpis: {
          errors: { count: 1, previous: 0 },
          events: { count: 1, previous: 0 },
          sessions: { count: 1, previous: 0 },
          activeUsers: { count: 1, previous: 0 },
          errorRatePct: { value: 50, previous: 0 },
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

describe("validatePrivateBriefResponse", () => {
  it("accepts a schema-valid, integrity-matching response", () => {
    const result = validatePrivateBriefResponse(snapshot(), {
      schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: REQUEST_ID,
      generatedAt: "2026-07-14T12:00:00.000Z",
      workspace: { title: "Workspace brief" },
      projects: [
        {
          projectId: PROJECT_A,
          generatedThrough: "2026-07-14T12:00:00.000Z",
          significance: "low",
          collapsedLabel: "1 error",
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid schema payloads", () => {
    const result = validatePrivateBriefResponse(snapshot(), { bad: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_response");
  });

  it("rejects integrity failures with the same codes as direct integrity checks", () => {
    const result = validatePrivateBriefResponse(snapshot(), {
      schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: "00000000-0000-4000-8000-000000000099",
      generatedAt: "2026-07-14T12:00:00.000Z",
      workspace: { title: "Workspace brief" },
      projects: [
        {
          projectId: PROJECT_A,
          generatedThrough: "2026-07-14T12:00:00.000Z",
          significance: "low",
          collapsedLabel: "1 error",
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("request_id_mismatch");
  });
});
