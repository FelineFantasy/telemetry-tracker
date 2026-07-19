import { describe, expect, it } from "vitest";
import {
  calcDeltaPctOrNew,
  formatNullablePctDelta,
  formatPpDelta,
  formatRelativeDelta,
} from "./compare-format";

describe("calcDeltaPctOrNew", () => {
  it("returns New for 0 → positive", () => {
    expect(calcDeltaPctOrNew(120, 0)).toEqual({ kind: "new" });
  });

  it("returns none for 0 → 0", () => {
    expect(calcDeltaPctOrNew(0, 0)).toEqual({ kind: "none" });
  });

  it("returns relative percent", () => {
    expect(calcDeltaPctOrNew(60, 120)).toEqual({ kind: "pct", value: -50 });
    expect(calcDeltaPctOrNew(24, 12)).toEqual({ kind: "pct", value: 100 });
  });
});

describe("formatRelativeDelta", () => {
  it("formats New / dash / signed percent", () => {
    expect(formatRelativeDelta(120, 0)).toEqual({ text: "New", tone: "new" });
    expect(formatRelativeDelta(0, 0)).toEqual({ text: "—", tone: "flat" });
    expect(formatRelativeDelta(60, 120).text).toBe("−50.0%");
    expect(formatRelativeDelta(24, 12).text).toBe("+100.0%");
  });
});

describe("formatPpDelta / formatNullablePctDelta", () => {
  it("formats pp and nullable percent deltas", () => {
    expect(formatPpDelta(2.5, 1).text).toBe("+1.5 pp");
    expect(formatPpDelta(null, 1)).toEqual({ text: "—", tone: "flat" });
    expect(formatNullablePctDelta(null)).toEqual({ text: "—", tone: "flat" });
    expect(formatNullablePctDelta(30).text).toBe("+30.0%");
  });
});
