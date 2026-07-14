import { describe, expect, it } from "vitest";
import { authorizeBriefAck } from "./brief-authz.js";
import type { ServedBriefMeta } from "./brief-served-meta.js";

const meta: ServedBriefMeta = {
  requestId: "c0000000-0000-4000-8000-000000000003",
  snapshotHash: "a".repeat(64),
  organizationId: "e0000000-0000-4000-8000-000000000005",
  source: "ai",
  servedAt: Date.now(),
  projects: [
    {
      projectId: "a0000000-0000-4000-8000-000000000001",
      generatedThrough: "2026-07-14T12:00:00.000Z",
    },
  ],
};

describe("authorizeBriefAck", () => {
  it("rejects fallback-served briefs", () => {
    const result = authorizeBriefAck(
      { ...meta, source: "fallback" },
      meta.organizationId,
      [
        {
          projectId: "a0000000-0000-4000-8000-000000000001",
          acknowledgedThrough: "2026-07-14T12:00:00.000Z",
        },
      ]
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("stale_brief");
  });

  it("rejects acknowledgement timestamps that do not match served metadata", () => {
    const result = authorizeBriefAck(meta, meta.organizationId, [
      {
        projectId: "a0000000-0000-4000-8000-000000000001",
        acknowledgedThrough: "2026-07-14T13:00:00.000Z",
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ack_timestamp_mismatch");
  });

  it("accepts matching cache-served metadata", () => {
    const result = authorizeBriefAck(
      { ...meta, source: "cache" },
      meta.organizationId,
      [
        {
          projectId: "a0000000-0000-4000-8000-000000000001",
          acknowledgedThrough: "2026-07-14T12:00:00.000Z",
        },
      ]
    );
    expect(result.ok).toBe(true);
  });

  it("rejects acknowledgement for dropped projects not present in served metadata", () => {
    const result = authorizeBriefAck(meta, meta.organizationId, [
      {
        projectId: "00000000-0000-4000-8000-000000000099",
        acknowledgedThrough: "2026-07-14T12:00:00.000Z",
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("project_not_in_served_brief");
  });
});
