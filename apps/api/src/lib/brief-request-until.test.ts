import { describe, expect, it } from "vitest";
import { floorToCompletedMinute } from "./brief-request-until.js";

describe("floorToCompletedMinute", () => {
  it("floors to the start of the current UTC minute", () => {
    const now = new Date("2026-07-14T12:34:15.789Z");
    expect(floorToCompletedMinute(now).toISOString()).toBe("2026-07-14T12:34:00.000Z");
  });

  it("uses the same bucket for two times in the same minute", () => {
    const a = new Date("2026-07-14T12:34:01.000Z");
    const b = new Date("2026-07-14T12:34:59.999Z");
    expect(floorToCompletedMinute(a).toISOString()).toBe(floorToCompletedMinute(b).toISOString());
  });

  it("advances to the next bucket on the next minute", () => {
    const first = floorToCompletedMinute(new Date("2026-07-14T12:34:59.999Z"));
    const second = floorToCompletedMinute(new Date("2026-07-14T12:35:00.000Z"));
    expect(second.getTime()).toBeGreaterThan(first.getTime());
    expect(second.toISOString()).toBe("2026-07-14T12:35:00.000Z");
  });
});
