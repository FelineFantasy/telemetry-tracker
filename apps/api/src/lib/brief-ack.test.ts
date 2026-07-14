import { describe, expect, it } from "vitest";
import {
  advanceAcknowledgedThrough,
  validateAckAgainstBriefMeta,
} from "./brief-ack.js";

describe("advanceAcknowledgedThrough", () => {
  const t1 = new Date("2026-07-10T12:00:00.000Z");
  const t2 = new Date("2026-07-12T12:00:00.000Z");

  it("uses incoming when no existing watermark", () => {
    expect(advanceAcknowledgedThrough(null, t1)).toEqual(t1);
  });

  it("keeps existing when incoming is earlier", () => {
    expect(advanceAcknowledgedThrough(t2, t1)).toEqual(t2);
  });

  it("advances when incoming is later", () => {
    expect(advanceAcknowledgedThrough(t1, t2)).toEqual(t2);
  });

  it("returns existing when timestamps are equal", () => {
    expect(advanceAcknowledgedThrough(t1, t1)).toEqual(t1);
  });
});

describe("validateAckAgainstBriefMeta", () => {
  const meta = {
    requestId: "b0000000-0000-4000-8000-000000000001",
    snapshotHash: "a".repeat(64),
  };

  it("accepts matching requestId and snapshotHash", () => {
    const result = validateAckAgainstBriefMeta(
      {
        requestId: meta.requestId,
        snapshotHash: meta.snapshotHash,
      },
      meta
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects mismatched requestId", () => {
    const result = validateAckAgainstBriefMeta(
      {
        requestId: "c0000000-0000-4000-8000-000000000001",
        snapshotHash: meta.snapshotHash,
      },
      meta
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("requestId");
    }
  });

  it("rejects mismatched snapshotHash", () => {
    const result = validateAckAgainstBriefMeta(
      {
        requestId: meta.requestId,
        snapshotHash: "b".repeat(64),
      },
      meta
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("snapshotHash");
    }
  });
});
