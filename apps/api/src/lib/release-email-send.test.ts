import { describe, expect, it } from "vitest";
import {
  emptyReleaseEmailAudienceMessage,
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

describe("emptyReleaseEmailAudienceMessage", () => {
  it("reports no active rows when the marketing list is empty", () => {
    expect(emptyReleaseEmailAudienceMessage(0)).toBe(
      "No active marketing subscribers. Re-run after subscribers exist; the workflow can be retried safely."
    );
    expect(emptyReleaseEmailAudienceMessage(0, { dryRun: true })).toBe(
      "--dry-run: would send to 0 subscriber(s)."
    );
  });

  it("explains when active rows were all filtered as undeliverable", () => {
    expect(emptyReleaseEmailAudienceMessage(2)).toContain(
      "No deliverable marketing subscribers (2 active row(s) skipped as reserved/invalid)"
    );
    expect(emptyReleaseEmailAudienceMessage(2, { dryRun: true })).toBe(
      "--dry-run: would send to 0 subscriber(s) (2 active row(s) skipped as reserved/invalid)."
    );
  });
});
