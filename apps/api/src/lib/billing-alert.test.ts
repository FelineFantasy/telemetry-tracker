import { describe, expect, it } from "vitest";
import { billingAlertVariant } from "./billing-alert.js";

describe("billingAlertVariant", () => {
  it("returns null for empty or unknown", () => {
    expect(billingAlertVariant(null)).toBeNull();
    expect(billingAlertVariant("")).toBeNull();
    expect(billingAlertVariant("active")).toBeNull();
  });

  it("maps Stripe statuses", () => {
    expect(billingAlertVariant("past_due")).toBe("past_due");
    expect(billingAlertVariant("PAST_DUE")).toBe("past_due");
    expect(billingAlertVariant("unpaid")).toBe("unpaid");
    expect(billingAlertVariant("canceled")).toBe("canceled");
    expect(billingAlertVariant("incomplete")).toBe("incomplete");
    expect(billingAlertVariant("INCOMPLETE_EXPIRED")).toBe("incomplete_expired");
  });
});
