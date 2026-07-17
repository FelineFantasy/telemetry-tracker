import { describe, expect, it } from "vitest";
import {
  formatAlertRuleSummary,
  isAlertRuleRow,
  type AlertRuleRow,
} from "./alert-rules";

const baseRule = {
  id: "rule-1",
  name: "Spike",
  enabled: true,
  destinationIds: ["project-email"],
  cooldownMinutes: 15,
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
};

describe("isAlertRuleRow", () => {
  it("accepts valid ERROR_COUNT rules", () => {
    expect(
      isAlertRuleRow({
        ...baseRule,
        conditions: [
          {
            type: "ERROR_COUNT",
            threshold: 25,
            windowMinutes: 15,
            environment: null,
          },
        ],
      })
    ).toBe(true);
  });

  it("accepts enabled rules with empty conditions (API unparsable JSON)", () => {
    expect(
      isAlertRuleRow({
        ...baseRule,
        enabled: true,
        conditions: [],
      })
    ).toBe(true);
  });

  it("rejects rows with malformed condition entries", () => {
    expect(
      isAlertRuleRow({
        ...baseRule,
        conditions: [{ type: "ERROR_COUNT", threshold: "25" }],
      })
    ).toBe(false);
  });
});

describe("formatAlertRuleSummary", () => {
  it("summarizes ERROR_COUNT conditions", () => {
    const rule: AlertRuleRow = {
      ...baseRule,
      conditions: [
        {
          type: "ERROR_COUNT",
          threshold: 10,
          windowMinutes: 5,
          environment: "production",
        },
      ],
    };
    expect(formatAlertRuleSummary(rule)).toBe(
      "≥ 10 errors / 5m in production"
    );
  });

  it("labels empty conditions as invalid/unsupported", () => {
    const rule: AlertRuleRow = { ...baseRule, conditions: [] };
    expect(formatAlertRuleSummary(rule)).toBe(
      "Invalid or unsupported conditions"
    );
  });
});
