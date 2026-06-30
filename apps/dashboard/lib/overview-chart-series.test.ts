import { describe, expect, it } from "vitest";
import { chartHasNoData } from "./overview-chart-series";

describe("chartHasNoData", () => {
  it("treats pct-only all-zero rows as empty", () => {
    expect(
      chartHasNoData(
        [
          { t: "Mon", pct: 0 },
          { t: "Tue", pct: 0 },
        ],
        "pct"
      )
    ).toBe(true);
  });

  it("treats value-only all-zero rows as empty", () => {
    expect(
      chartHasNoData(
        [
          { t: "Mon", value: 0 },
          { t: "Tue", value: 0 },
        ],
        "value"
      )
    ).toBe(true);
  });

  it("detects non-zero values on the active data key", () => {
    expect(chartHasNoData([{ t: "Mon", value: 3 }], "value")).toBe(false);
  });
});
