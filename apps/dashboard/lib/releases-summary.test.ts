import { describe, expect, it } from "vitest";
import { releaseVsPreviousDeltaClass } from "./releases-summary";

describe("releaseVsPreviousDeltaClass", () => {
  it("treats higher sessions as good by default", () => {
    expect(releaseVsPreviousDeltaClass(12)).toBe("text-success");
    expect(releaseVsPreviousDeltaClass(-8)).toBe("text-destructive");
  });

  it("treats higher error rate / errors as bad when inverted", () => {
    expect(releaseVsPreviousDeltaClass(3.5, true)).toBe("text-destructive");
    expect(releaseVsPreviousDeltaClass(-1.2, true)).toBe("text-success");
  });

  it("uses muted tone for flat deltas", () => {
    expect(releaseVsPreviousDeltaClass(0)).toBe("text-muted-foreground");
    expect(releaseVsPreviousDeltaClass(0, true)).toBe("text-muted-foreground");
  });
});
