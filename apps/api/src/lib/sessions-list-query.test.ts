import { describe, expect, it } from "vitest";
import {
  SESSION_PAGE_EVENT_NAMES,
  isSessionAggregateSort,
  parseSessionListOrderParam,
  parseSessionListSortParam,
  resolveSessionStatus,
  serializeSessionListItem,
} from "./sessions-list-query.js";

describe("parseSessionListSortParam", () => {
  it("defaults to duration", () => {
    const r = parseSessionListSortParam(undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sort).toBe("duration");
  });

  it("accepts enriched sort fields", () => {
    expect(parseSessionListSortParam("events").ok).toBe(true);
    expect(parseSessionListSortParam("pages").ok).toBe(true);
    expect(parseSessionListSortParam("status").ok).toBe(true);
    expect(parseSessionListSortParam("started_at").ok).toBe(true);
  });

  it("rejects unknown sort fields", () => {
    expect(parseSessionListSortParam("invalid").ok).toBe(false);
  });
});

describe("parseSessionListOrderParam", () => {
  it("defaults to desc", () => {
    const r = parseSessionListOrderParam(undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order).toBe("desc");
  });
});

describe("isSessionAggregateSort", () => {
  it("routes aggregate metrics through the SQL path", () => {
    expect(isSessionAggregateSort("duration")).toBe(true);
    expect(isSessionAggregateSort("events")).toBe(true);
    expect(isSessionAggregateSort("pages")).toBe(true);
    expect(isSessionAggregateSort("status")).toBe(true);
    expect(isSessionAggregateSort("started_at")).toBe(false);
  });
});

describe("resolveSessionStatus", () => {
  it("maps crash-free sessions to healthy", () => {
    expect(resolveSessionStatus(false)).toBe("healthy");
  });

  it("maps sessions with errors to warning", () => {
    expect(resolveSessionStatus(true)).toBe("warning");
  });
});

describe("serializeSessionListItem", () => {
  const baseRow = {
    id: "uuid-1",
    session_id: "sess_abc",
    app: "web",
    platform: "web",
    user_id: "user_1",
    anonymous_id: null,
    user_email: "user@example.com",
    country: "US",
    device_browser: "Chrome",
    device_os: "macOS",
    sdk_version: "1.0.0",
    started_at: new Date("2026-06-01T10:00:00.000Z"),
    ended_at: new Date("2026-06-01T10:05:30.000Z"),
    duration_sec: 330,
    event_count: 12,
    page_count: 3,
    status: "healthy" as const,
  };

  it("serializes enriched row with ISO dates", () => {
    const item = serializeSessionListItem(baseRow, 600);
    expect(item.session_id).toBe("sess_abc");
    expect(item.duration_sec).toBe(330);
    expect(item.event_count).toBe(12);
    expect(item.page_count).toBe(3);
    expect(item.status).toBe("healthy");
    expect(item.user_email).toBe("user@example.com");
    expect(item.country).toBe("US");
    expect(item.device_browser).toBe("Chrome");
    expect(item.device_os).toBe("macOS");
    expect(item.started_at).toBe("2026-06-01T10:00:00.000Z");
    expect(item.ended_at).toBe("2026-06-01T10:05:30.000Z");
    expect(item.max_duration_sec).toBe(600);
  });

  it("defaults max_duration_sec to null when omitted", () => {
    const item = serializeSessionListItem(baseRow);
    expect(item.max_duration_sec).toBeNull();
  });
});

describe("SESSION_PAGE_EVENT_NAMES", () => {
  it("includes SDK auto screen and common legacy names", () => {
    expect(SESSION_PAGE_EVENT_NAMES).toContain("$screen");
    expect(SESSION_PAGE_EVENT_NAMES).toContain("page_view");
  });
});
