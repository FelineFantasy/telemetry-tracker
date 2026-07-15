import { describe, expect, it, vi } from "vitest";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import { findCurrentBriefCompleted } from "./brief-completed.js";

const ORG_ID = "e0000000-0000-4000-8000-000000000005";
const IDENTITY = {
  organizationId: ORG_ID,
  contentHash: "c".repeat(64),
  presentationHash: "p".repeat(64),
  responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
};

const REQUEST_ID = "b0000000-0000-4000-8000-000000000099";

const validBriefJson = {
  schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
  requestId: REQUEST_ID,
  generatedAt: "2026-07-14T12:34:00.000Z",
  workspace: { title: "Brief" },
  projects: [
    {
      projectId: "a0000000-0000-4000-8000-000000000001",
      generatedThrough: "2026-07-14T12:34:00.000Z",
      significance: "none" as const,
      collapsedLabel: "No changes",
    },
  ],
};

describe("findCurrentBriefCompleted", () => {
  it("returns null when the completed brief has expired", async () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const findUnique = vi.fn().mockResolvedValue({
      id: "completed-1",
      organization_id: ORG_ID,
      content_hash: IDENTITY.contentHash,
      presentation_hash: IDENTITY.presentationHash,
      response_schema_version: IDENTITY.responseSchemaVersion,
      request_id: REQUEST_ID,
      snapshot_hash: "d".repeat(64),
      brief_json: validBriefJson,
      completed_at: new Date("2026-07-14T12:00:00.000Z"),
      expires_at: new Date("2026-08-14T12:00:00.000Z"),
    });

    const prisma = { briefCompleted: { findUnique } } as never;
    const result = await findCurrentBriefCompleted(prisma, IDENTITY, now);

    expect(result).toBeNull();
  });

  it("returns the row when expires_at is in the future", async () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const findUnique = vi.fn().mockResolvedValue({
      id: "completed-1",
      organization_id: ORG_ID,
      content_hash: IDENTITY.contentHash,
      presentation_hash: IDENTITY.presentationHash,
      response_schema_version: IDENTITY.responseSchemaVersion,
      request_id: REQUEST_ID,
      snapshot_hash: "d".repeat(64),
      brief_json: validBriefJson,
      completed_at: new Date("2026-07-14T12:00:00.000Z"),
      expires_at: new Date("2026-08-14T12:00:00.000Z"),
    });

    const prisma = { briefCompleted: { findUnique } } as never;
    const result = await findCurrentBriefCompleted(prisma, IDENTITY, now);

    expect(result?.requestId).toBe(REQUEST_ID);
  });
});
