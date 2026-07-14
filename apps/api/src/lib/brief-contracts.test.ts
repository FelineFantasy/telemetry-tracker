import { describe, expect, it } from "vitest";
import {
  BRIEF_MAX_CANDIDATES_PER_LIST,
  BRIEF_RESPONSE_SCHEMA_VERSION,
  BRIEF_SCHEMA_VERSION,
} from "./brief-constants.js";
import {
  acknowledgeBriefRequestSchema,
  briefActionSchema,
  briefSnapshotRequestSchema,
  parseAcknowledgeBriefRequest,
  parseBriefSnapshotRequest,
  parseWorkspaceBriefResponse,
  projectSnapshotSchema,
  workspaceBriefResponseSchema,
} from "./brief-contracts.js";

const PROJECT_ID = "a0000000-0000-4000-8000-000000000001";
const ORG_ID = "a0000000-0000-4000-8000-000000000002";
const REQUEST_ID = "b0000000-0000-4000-8000-000000000003";
const ERROR_GROUP_ID = "c0000000-0000-4000-8000-000000000004";
const SNAPSHOT_HASH = "a".repeat(64);

function minimalErrorGroupCandidate() {
  return {
    id: ERROR_GROUP_ID,
    message: "TypeError: Cannot read properties of undefined",
    app: "web",
    firstSeen: "2026-07-12T10:00:00.000Z",
    lastSeen: "2026-07-14T11:00:00.000Z",
    occurrences: { count: 10, previous: 2 },
    affectedUsers: { count: 5, previous: 1 },
  };
}

function minimalProjectSnapshot() {
  return {
    projectId: PROJECT_ID,
    projectName: "Acme Production",
    projectSlug: "acme-production",
    window: {
      since: "2026-07-07T12:00:00.000Z",
      until: "2026-07-14T12:00:00.000Z",
      previousSince: "2026-06-30T12:00:00.000Z",
      previousUntil: "2026-07-07T12:00:00.000Z",
      durationMs: 7 * 24 * 60 * 60 * 1000,
    },
    kpis: {
      errors: { count: 100, previous: 80 },
      events: { count: 5000, previous: 4800 },
      sessions: { count: 200, previous: 190 },
      activeUsers: { count: 150, previous: 140 },
      errorRatePct: { value: 1.96, previous: 1.64 },
    },
    errorGroups: {
      firstSeenInWindow: [minimalErrorGroupCandidate()],
      byOccurrenceCount: [minimalErrorGroupCandidate()],
      byAbsoluteDelta: [minimalErrorGroupCandidate()],
    },
  };
}

function minimalSnapshotRequest() {
  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    requestId: REQUEST_ID,
    generatedAt: "2026-07-14T12:00:00.000Z",
    organizationId: ORG_ID,
    viewer: { timezone: "Europe/Berlin" },
    projects: [minimalProjectSnapshot()],
  };
}

describe("briefSnapshotRequestSchema", () => {
  it("parses a valid minimal snapshot request", () => {
    const parsed = briefSnapshotRequestSchema.safeParse(minimalSnapshotRequest());
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown keys such as userId", () => {
    const parsed = briefSnapshotRequestSchema.safeParse({
      ...minimalSnapshotRequest(),
      userId: "d0000000-0000-4000-8000-000000000005",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects candidate lists longer than the configured maximum", () => {
    const overflow = Array.from({ length: BRIEF_MAX_CANDIDATES_PER_LIST + 1 }, () =>
      minimalErrorGroupCandidate()
    );
    const parsed = briefSnapshotRequestSchema.safeParse({
      ...minimalSnapshotRequest(),
      projects: [
        {
          ...minimalProjectSnapshot(),
          errorGroups: {
            firstSeenInWindow: overflow,
            byOccurrenceCount: [],
            byAbsoluteDelta: [],
          },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("parseBriefSnapshotRequest returns ok for valid input", () => {
    const result = parseBriefSnapshotRequest(minimalSnapshotRequest());
    expect(result.ok).toBe(true);
  });

  it("accepts factual environment distribution rows", () => {
    const parsed = briefSnapshotRequestSchema.safeParse({
      ...minimalSnapshotRequest(),
      projects: [
        {
          ...minimalProjectSnapshot(),
          environments: {
            byEventRows: [
              { environment: "production", count: 1200 },
              { environment: "staging", count: 45 },
            ],
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown keys on project snapshots such as primaryEnvironment", () => {
    const parsed = briefSnapshotRequestSchema.safeParse({
      ...minimalSnapshotRequest(),
      projects: [
        {
          ...minimalProjectSnapshot(),
          primaryEnvironment: "production",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown keys on nested project snapshots via projectSnapshotSchema", () => {
    expect(
      projectSnapshotSchema.safeParse({
        ...minimalProjectSnapshot(),
        href: "/dashboard/overview",
      }).success
    ).toBe(false);
    expect(
      projectSnapshotSchema.safeParse({
        ...minimalProjectSnapshot(),
        metadata: { source: "manual" },
      }).success
    ).toBe(false);
    expect(
      projectSnapshotSchema.safeParse({
        ...minimalProjectSnapshot(),
        errorGroups: {
          ...minimalProjectSnapshot().errorGroups,
          extraList: [],
        },
      }).success
    ).toBe(false);
  });
});

describe("briefActionSchema", () => {
  it("parses open_error_group actions", () => {
    const parsed = briefActionSchema.safeParse({
      type: "open_error_group",
      projectId: PROJECT_ID,
      errorGroupId: ERROR_GROUP_ID,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects actions with href", () => {
    const parsed = briefActionSchema.safeParse({
      type: "open_overview",
      projectId: PROJECT_ID,
      href: "/dashboard/overview",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("workspaceBriefResponseSchema", () => {
  it("requires generatedThrough on every project", () => {
    const parsed = workspaceBriefResponseSchema.safeParse({
      schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: REQUEST_ID,
      generatedAt: "2026-07-14T12:00:00.000Z",
      workspace: { title: "Workspace brief" },
      projects: [
        {
          projectId: PROJECT_ID,
          generatedThrough: "2026-07-14T12:00:00.000Z",
          significance: "none",
          collapsedLabel: "Nothing important happened.",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects projects missing generatedThrough", () => {
    const parsed = workspaceBriefResponseSchema.safeParse({
      schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: REQUEST_ID,
      generatedAt: "2026-07-14T12:00:00.000Z",
      workspace: { title: "Workspace brief" },
      projects: [
        {
          projectId: PROJECT_ID,
          significance: "none",
          collapsedLabel: "Nothing important happened.",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("parseWorkspaceBriefResponse returns ok for valid input", () => {
    const result = parseWorkspaceBriefResponse({
      schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: REQUEST_ID,
      generatedAt: "2026-07-14T12:00:00.000Z",
      workspace: { title: "Workspace brief" },
      projects: [
        {
          projectId: PROJECT_ID,
          generatedThrough: "2026-07-14T12:00:00.000Z",
          significance: "high",
          collapsedLabel: "3 issues need attention",
          suggestedNextStep: {
            type: "open_errors",
            projectId: PROJECT_ID,
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown keys on workspace brief responses", () => {
    const parsed = workspaceBriefResponseSchema.safeParse({
      schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      requestId: REQUEST_ID,
      generatedAt: "2026-07-14T12:00:00.000Z",
      workspace: { title: "Workspace brief", extra: true },
      projects: [
        {
          projectId: PROJECT_ID,
          generatedThrough: "2026-07-14T12:00:00.000Z",
          significance: "none",
          collapsedLabel: "Nothing important happened.",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("acknowledgeBriefRequestSchema", () => {
  it("requires requestId and snapshotHash", () => {
    const parsed = acknowledgeBriefRequestSchema.safeParse({
      requestId: REQUEST_ID,
      snapshotHash: SNAPSHOT_HASH,
      projects: [
        {
          projectId: PROJECT_ID,
          acknowledgedThrough: "2026-07-14T12:00:00.000Z",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing snapshotHash", () => {
    const parsed = acknowledgeBriefRequestSchema.safeParse({
      requestId: REQUEST_ID,
      projects: [
        {
          projectId: PROJECT_ID,
          acknowledgedThrough: "2026-07-14T12:00:00.000Z",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("parseAcknowledgeBriefRequest returns ok for valid input", () => {
    const result = parseAcknowledgeBriefRequest({
      requestId: REQUEST_ID,
      snapshotHash: SNAPSHOT_HASH,
      projects: [
        {
          projectId: PROJECT_ID,
          acknowledgedThrough: "2026-07-14T12:00:00.000Z",
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown keys on acknowledge projects", () => {
    const parsed = acknowledgeBriefRequestSchema.safeParse({
      requestId: REQUEST_ID,
      snapshotHash: SNAPSHOT_HASH,
      projects: [
        {
          projectId: PROJECT_ID,
          acknowledgedThrough: "2026-07-14T12:00:00.000Z",
          href: "/dashboard",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
