import { describe, expect, it } from "vitest";
import { BRIEF_MAX_LOOKBACK_MS } from "./brief-constants.js";
import {
  resolveBriefProjectWindow,
  resolveBriefProjectWindows,
} from "./brief-window.js";

const PROJECT_ID = "a0000000-0000-4000-8000-000000000001";

describe("resolveBriefProjectWindow", () => {
  const until = new Date("2026-07-14T12:00:00.000Z");
  const projectCreatedAt = new Date("2026-06-01T00:00:00.000Z");

  it("uses project creation when never acknowledged and project is younger than lookback", () => {
    const youngProjectCreatedAt = new Date("2026-07-10T00:00:00.000Z");
    const w = resolveBriefProjectWindow({
      projectId: PROJECT_ID,
      projectCreatedAt: youngProjectCreatedAt,
      acknowledgedThrough: null,
      requestUntil: until,
    });

    expect(w.until).toEqual(until);
    expect(w.since).toEqual(youngProjectCreatedAt);
    expect(w.previousUntil).toEqual(w.since);
    expect(w.previousSince.getTime()).toBe(w.since.getTime() - w.durationMs);
    expect(w.durationMs).toBe(until.getTime() - youngProjectCreatedAt.getTime());
  });

  it("uses acknowledged_through when more recent than creation", () => {
    const acknowledgedThrough = new Date("2026-07-12T00:00:00.000Z");
    const w = resolveBriefProjectWindow({
      projectId: PROJECT_ID,
      projectCreatedAt,
      acknowledgedThrough,
      requestUntil: until,
    });

    expect(w.since).toEqual(acknowledgedThrough);
    expect(w.durationMs).toBe(until.getTime() - acknowledgedThrough.getTime());
  });

  it("caps lookback at BRIEF_MAX_LOOKBACK_MS when acknowledgement is stale", () => {
    const acknowledgedThrough = new Date("2026-01-01T00:00:00.000Z");
    const w = resolveBriefProjectWindow({
      projectId: PROJECT_ID,
      projectCreatedAt,
      acknowledgedThrough,
      requestUntil: until,
    });

    const lookbackFloor = new Date(until.getTime() - BRIEF_MAX_LOOKBACK_MS);
    expect(w.since).toEqual(lookbackFloor);
  });

  it("never resolves since before projectCreatedAt", () => {
    const acknowledgedThrough = new Date("2026-05-01T00:00:00.000Z");
    const youngProjectCreatedAt = new Date("2026-07-10T00:00:00.000Z");
    const w = resolveBriefProjectWindow({
      projectId: PROJECT_ID,
      projectCreatedAt: youngProjectCreatedAt,
      acknowledgedThrough,
      requestUntil: until,
    });

    expect(w.since.getTime()).toBeGreaterThanOrEqual(youngProjectCreatedAt.getTime());
    expect(w.since).toEqual(youngProjectCreatedAt);
  });

  it("never resolves since before projectCreatedAt when lookback would go earlier", () => {
    const youngProjectCreatedAt = new Date("2026-07-13T00:00:00.000Z");
    const w = resolveBriefProjectWindow({
      projectId: PROJECT_ID,
      projectCreatedAt: youngProjectCreatedAt,
      acknowledgedThrough: null,
      requestUntil: until,
    });

    expect(w.since).toEqual(youngProjectCreatedAt);
    expect(w.since.getTime()).toBeGreaterThan(
      until.getTime() - BRIEF_MAX_LOOKBACK_MS
    );
  });

  it("uses immediately preceding window of equal length for previous period", () => {
    const acknowledgedThrough = new Date("2026-07-12T00:00:00.000Z");
    const w = resolveBriefProjectWindow({
      projectId: PROJECT_ID,
      projectCreatedAt,
      acknowledgedThrough,
      requestUntil: until,
    });

    expect(w.previousUntil).toEqual(w.since);
    expect(w.previousSince.getTime()).toBe(w.since.getTime() - w.durationMs);
    expect(w.durationMs).toBe(w.until.getTime() - w.since.getTime());
  });

  it("ensures durationMs is at least 1 when since equals until", () => {
    const sameInstant = new Date("2026-07-14T12:00:00.000Z");
    const w = resolveBriefProjectWindow({
      projectId: PROJECT_ID,
      projectCreatedAt: sameInstant,
      acknowledgedThrough: sameInstant,
      requestUntil: sameInstant,
    });

    expect(w.durationMs).toBe(1);
    expect(w.previousSince.getTime()).toBe(sameInstant.getTime() - 1);
  });
});

describe("resolveBriefProjectWindows", () => {
  it("shares one requestUntil across all projects", () => {
    const until = new Date("2026-07-14T12:00:00.000Z");
    const windows = resolveBriefProjectWindows(
      [
        {
          projectId: "a0000000-0000-4000-8000-000000000001",
          projectCreatedAt: new Date("2026-06-01T00:00:00.000Z"),
          acknowledgedThrough: null,
          requestUntil: until,
        },
        {
          projectId: "a0000000-0000-4000-8000-000000000002",
          projectCreatedAt: new Date("2026-07-01T00:00:00.000Z"),
          acknowledgedThrough: new Date("2026-07-10T00:00:00.000Z"),
          requestUntil: until,
        },
      ],
      until
    );

    expect(windows).toHaveLength(2);
    expect(windows[0]?.until).toEqual(until);
    expect(windows[1]?.until).toEqual(until);
    expect(windows[0]?.projectId).toBe("a0000000-0000-4000-8000-000000000001");
    expect(windows[1]?.projectId).toBe("a0000000-0000-4000-8000-000000000002");
  });
});
