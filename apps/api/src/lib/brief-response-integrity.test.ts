import { describe, expect, it } from "vitest";
import { BRIEF_RESPONSE_SCHEMA_VERSION, BRIEF_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import { validateWorkspaceBriefResponseIntegrity } from "./brief-response-integrity.js";

const PROJECT_A = "a0000000-0000-4000-8000-000000000001";
const PROJECT_B = "b0000000-0000-4000-8000-000000000002";
const REQUEST_ID = "c0000000-0000-4000-8000-000000000003";
const ERROR_GROUP_A = "d0000000-0000-4000-8000-000000000004";

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
          firstSeenInWindow: [
            {
              id: ERROR_GROUP_A,
              message: "Error",
              app: "web",
              firstSeen: "2026-07-12T10:00:00.000Z",
              lastSeen: "2026-07-14T11:00:00.000Z",
              occurrences: { count: 1, previous: 0 },
              affectedUsers: { count: 1, previous: 0 },
            },
          ],
          byOccurrenceCount: [],
          byAbsoluteDelta: [],
        },
      },
      {
        projectId: PROJECT_B,
        projectName: "Beta",
        projectSlug: "beta",
        window: {
          since: "2026-07-07T12:00:00.000Z",
          until: "2026-07-14T13:00:00.000Z",
          previousSince: "2026-06-30T12:00:00.000Z",
          previousUntil: "2026-07-07T12:00:00.000Z",
          durationMs: 604800000,
        },
        kpis: {
          errors: { count: 2, previous: 1 },
          events: { count: 2, previous: 1 },
          sessions: { count: 2, previous: 1 },
          activeUsers: { count: 2, previous: 1 },
          errorRatePct: { value: 50, previous: 50 },
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

function validResponse() {
  return {
    schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    requestId: REQUEST_ID,
    generatedAt: "2026-07-14T12:00:00.000Z",
    workspace: { title: "Workspace brief" },
    projects: [
      {
        projectId: PROJECT_A,
        generatedThrough: "2026-07-14T12:00:00.000Z",
        significance: "low" as const,
        collapsedLabel: "1 error",
      },
      {
        projectId: PROJECT_B,
        generatedThrough: "2026-07-14T13:00:00.000Z",
        significance: "none" as const,
        collapsedLabel: "No changes",
      },
    ],
  };
}

describe("validateWorkspaceBriefResponseIntegrity", () => {
  it("accepts a complete matching response", () => {
    expect(validateWorkspaceBriefResponseIntegrity(snapshot(), validResponse())).toEqual({
      ok: true,
    });
  });

  it("rejects mismatched requestId", () => {
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), {
      ...validResponse(),
      requestId: "00000000-0000-4000-8000-000000000099",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("request_id_mismatch");
  });

  it("rejects missing project", () => {
    const response = validResponse();
    response.projects = response.projects.filter((p) => p.projectId !== PROJECT_B);
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing_project");
  });

  it("rejects unknown project", () => {
    const response = validResponse();
    response.projects.push({
      projectId: "00000000-0000-4000-8000-000000000099",
      generatedThrough: "2026-07-14T12:00:00.000Z",
      significance: "none",
      collapsedLabel: "Extra",
    });
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown_project");
  });

  it("rejects duplicate project", () => {
    const response = validResponse();
    response.projects = [response.projects[0]!, response.projects[0]!];
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("duplicate_project");
  });

  it("rejects wrong generatedThrough", () => {
    const response = validResponse();
    response.projects[0]!.generatedThrough = "2026-07-14T13:00:00.000Z";
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("generated_through_mismatch");
  });

  it("rejects actions referencing unknown projects", () => {
    const response = validResponse();
    response.projects[0]!.suggestedNextStep = {
      type: "open_errors",
      projectId: "00000000-0000-4000-8000-000000000099",
    };
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("action_project_mismatch");
  });

  it("rejects actions referencing unknown error groups", () => {
    const response = validResponse();
    response.projects[0]!.suggestedNextStep = {
      type: "open_error_group",
      projectId: PROJECT_A,
      errorGroupId: "00000000-0000-4000-8000-000000000099",
    };
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("action_error_group_unknown");
  });

  it("accepts bullets with snapshot-bound error_group evidence refs", () => {
    const response = validResponse();
    response.projects[0]!.bullets = [
      {
        tone: "warning",
        text: "New error surfaced",
        evidenceRefs: [{ kind: "error_group", id: ERROR_GROUP_A }],
      },
    ];
    expect(validateWorkspaceBriefResponseIntegrity(snapshot(), response)).toEqual({ ok: true });
  });

  it("rejects bullets referencing unknown error_group evidence refs", () => {
    const response = validResponse();
    response.projects[0]!.bullets = [
      {
        tone: "warning",
        text: "Fabricated evidence",
        evidenceRefs: [{ kind: "error_group", id: "00000000-0000-4000-8000-000000000099" }],
      },
    ];
    const result = validateWorkspaceBriefResponseIntegrity(snapshot(), response);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_error_group_unknown");
  });
});
