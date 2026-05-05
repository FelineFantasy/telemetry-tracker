import { describe, expect, it } from "vitest";
import {
  stripeInvoiceSubscriptionId,
  stripeSubscriptionPeriodEndUnix,
} from "./stripe-runtime-fields.js";

describe("stripeSubscriptionPeriodEndUnix", () => {
  it("reads current_period_end when present", () => {
    expect(stripeSubscriptionPeriodEndUnix({ current_period_end: 1_700_000_000 })).toBe(
      1_700_000_000
    );
    expect(stripeSubscriptionPeriodEndUnix({})).toBeNull();
  });
});

describe("stripeInvoiceSubscriptionId", () => {
  it("reads string or expanded object id", () => {
    expect(stripeInvoiceSubscriptionId({ subscription: "sub_123" })).toBe("sub_123");
    expect(stripeInvoiceSubscriptionId({ subscription: { id: "sub_456" } })).toBe(
      "sub_456"
    );
    expect(stripeInvoiceSubscriptionId({})).toBeNull();
  });
});
