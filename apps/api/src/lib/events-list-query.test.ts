import { describe, expect, it } from "vitest";
import {
  isEventAggregateSort,
  parseEventListSortParam,
  resolveEventCountRangeBounds,
  serializeEventNameListItem,
} from "./events-list-query.js";

describe("isEventAggregateSort", () => {
  it("routes count, users, and sessions through the aggregate path", () => {
    expect(isEventAggregateSort("count")).toBe(true);
    expect(isEventAggregateSort("users")).toBe(true);
    expect(isEventAggregateSort("sessions")).toBe(true);
    expect(isEventAggregateSort("last_seen")).toBe(false);
    expect(isEventAggregateSort("name")).toBe(false);
  });
});

describe("parseEventListSortParam", () => {
  it("defaults to last_seen", () => {
    const r = parseEventListSortParam(undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sort).toBe("last_seen");
  });

  it("accepts grouped sort fields and maps legacy raw-list sorts", () => {
    expect(parseEventListSortParam("count").ok).toBe(true);
    expect(parseEventListSortParam("users").ok).toBe(true);
    const legacy = parseEventListSortParam("created_at");
    expect(legacy.ok).toBe(true);
    if (legacy.ok) expect(legacy.sort).toBe("last_seen");
  });
});

describe("resolveEventCountRangeBounds", () => {
  it("uses enriched eventCountRange when list range is all-time", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    expect(
      resolveEventCountRangeBounds({
        range: {},
        eventCountRange: { gte: since, lte: until },
      })
    ).toEqual({ gte: since, lte: until });
  });

  it("prefers explicit list range bounds over eventCountRange", () => {
    const since = new Date("2026-05-01T00:00:00.000Z");
    const until = new Date("2026-05-08T00:00:00.000Z");
    expect(
      resolveEventCountRangeBounds({
        range: { gte: since, lte: until },
        eventCountRange: {
          gte: new Date("2026-06-01T00:00:00.000Z"),
          lte: new Date("2026-06-08T00:00:00.000Z"),
        },
      })
    ).toEqual({ gte: since, lte: until });
  });
});

describe("serializeEventNameListItem", () => {
  const baseRow = {
    name: "screen_view",
    app: "web",
    platform: "web",
    environment: "production",
    release: "1.0.0",
    count: 100,
    count_in_range: 42,
    first_seen: new Date("2026-06-01T00:00:00.000Z"),
    last_seen: new Date("2026-06-08T00:00:00.000Z"),
    users_affected: 10,
    sessions_affected: 15,
    share_pct: 12.5,
    latest_event_id: "evt_1",
  };

  it("serializes grouped row with ISO dates", () => {
    const item = serializeEventNameListItem(baseRow);
    expect(item.name).toBe("screen_view");
    expect(item.count_in_range).toBe(42);
    expect(item.first_seen).toBe("2026-06-01T00:00:00.000Z");
    expect(item.last_seen).toBe("2026-06-08T00:00:00.000Z");
    expect(item.share_pct).toBe(12.5);
    expect(item.latest_event_id).toBe("evt_1");
  });

  it("defaults latest_event_id to null when missing", () => {
    const { latest_event_id: _, ...row } = baseRow;
    const item = serializeEventNameListItem(row);
    expect(item.latest_event_id).toBeNull();
  });
});
