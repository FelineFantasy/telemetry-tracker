import { describe, expect, it } from "vitest";
import {
  isReleaseEmailBroadcastComplete,
  pendingReleaseEmailRecipients,
} from "./release-email-send.js";

describe("isReleaseEmailBroadcastComplete", () => {
  it("is incomplete when there are no subscribers", () => {
    expect(isReleaseEmailBroadcastComplete(0, 0)).toBe(false);
  });

  it("is complete when every subscriber was sent", () => {
    expect(isReleaseEmailBroadcastComplete(3, 3)).toBe(true);
  });

  it("is incomplete when some or all sends failed", () => {
    expect(isReleaseEmailBroadcastComplete(0, 3)).toBe(false);
    expect(isReleaseEmailBroadcastComplete(2, 3)).toBe(false);
  });
});

describe("pendingReleaseEmailRecipients", () => {
  it("returns subscribers without a prior send record", () => {
    const subscribers = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(pendingReleaseEmailRecipients(subscribers, new Set(["b"]))).toEqual([
      { id: "a" },
      { id: "c" },
    ]);
  });
});
