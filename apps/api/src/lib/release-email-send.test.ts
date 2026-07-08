import { describe, expect, it } from "vitest";
import { isReleaseEmailBroadcastComplete } from "./release-email-send.js";

describe("isReleaseEmailBroadcastComplete", () => {
  it("is complete when there are no subscribers", () => {
    expect(isReleaseEmailBroadcastComplete(0, 0)).toBe(true);
  });

  it("is complete when every subscriber was sent", () => {
    expect(isReleaseEmailBroadcastComplete(3, 3)).toBe(true);
  });

  it("is incomplete when some or all sends failed", () => {
    expect(isReleaseEmailBroadcastComplete(0, 3)).toBe(false);
    expect(isReleaseEmailBroadcastComplete(2, 3)).toBe(false);
  });
});
