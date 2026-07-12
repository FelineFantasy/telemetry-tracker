import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIT_LOG_LIMIT,
  encodeAuditLogCursor,
  parseAuditLogQuery,
} from "./audit-log.js";

describe("audit-log", () => {
  it("defaults limit and accepts no cursor", () => {
    const parsed = parseAuditLogQuery({});
    expect(parsed).toEqual({ limit: DEFAULT_AUDIT_LOG_LIMIT, cursor: null });
  });

  it("parses limit and cursor", () => {
    const createdAt = new Date("2026-07-12T12:00:00.000Z");
    const id = "abc-123";
    const cursor = encodeAuditLogCursor(createdAt, id);
    const parsed = parseAuditLogQuery({ limit: "10", cursor });
    expect(parsed).toEqual({
      limit: 10,
      cursor: { createdAt, id },
    });
  });

  it("rejects invalid limit and cursor", () => {
    expect(parseAuditLogQuery({ limit: "0" })).toEqual({
      error: "limit must be between 1 and 100",
    });
    expect(parseAuditLogQuery({ cursor: "bad" })).toEqual({ error: "Invalid cursor" });
  });
});
