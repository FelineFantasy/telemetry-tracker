import { describe, expect, it } from "vitest";
import { formatPlanPriceEur, PLAN_LIST_PRICES_EUR } from "./plan-pricing";

describe("plan-pricing", () => {
  it("formats EUR list prices", () => {
    expect(formatPlanPriceEur(PLAN_LIST_PRICES_EUR.FREE)).toBe("€0");
    expect(formatPlanPriceEur(PLAN_LIST_PRICES_EUR.PRO)).toMatch(/29/);
    expect(formatPlanPriceEur(PLAN_LIST_PRICES_EUR.BUSINESS)).toMatch(/99/);
  });
});
