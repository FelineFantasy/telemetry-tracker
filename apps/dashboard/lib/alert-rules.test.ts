import { describe, expect, it } from "vitest";
import {
  createDefaultAlertRuleDraft,
  createEmptyErrorCountCondition,
  draftFromAlertRule,
  formatAlertRuleDestinations,
  formatAlertRuleSummary,
  isAlertRuleRow,
  MAX_ALERT_RULE_CONDITIONS,
  PROJECT_EMAIL_DESTINATION_ID,
  validateAlertRuleDraft,
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

  it("joins multiple conditions with AND", () => {
    const rule: AlertRuleRow = {
      ...baseRule,
      conditions: [
        {
          type: "ERROR_COUNT",
          threshold: 10,
          windowMinutes: 5,
          environment: "production",
        },
        {
          type: "ERROR_COUNT",
          threshold: 50,
          windowMinutes: 60,
          environment: null,
        },
      ],
    };
    expect(formatAlertRuleSummary(rule)).toBe(
      "≥ 10 errors / 5m in production AND ≥ 50 errors / 60m"
    );
  });

  it("labels empty conditions as invalid/unsupported", () => {
    const rule: AlertRuleRow = { ...baseRule, conditions: [] };
    expect(formatAlertRuleSummary(rule)).toBe(
      "Invalid or unsupported conditions"
    );
  });
});

describe("formatAlertRuleDestinations", () => {
  it("lists email and channel kinds", () => {
    expect(
      formatAlertRuleDestinations(
        [PROJECT_EMAIL_DESTINATION_ID, "wh-1"],
        [
          {
            id: PROJECT_EMAIL_DESTINATION_ID,
            label: "Project alert email",
            kind: "Email",
            enabled: true,
          },
          {
            id: "wh-1",
            label: "#ops",
            kind: "Slack",
            enabled: true,
          },
        ]
      )
    ).toBe("project email · Slack");
  });

  it("marks disabled and missing bindings", () => {
    expect(
      formatAlertRuleDestinations(["wh-1", "wh-missing"], [
        {
          id: "wh-1",
          label: "ops",
          kind: "Discord",
          enabled: false,
        },
      ])
    ).toBe("Discord (disabled) · 1 missing binding");
  });
});

describe("validateAlertRuleDraft", () => {
  it("accepts a default draft with email destination", () => {
    const draft = createDefaultAlertRuleDraft();
    draft.name = "Prod spike";
    const result = validateAlertRuleDraft(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.conditions).toHaveLength(1);
      expect(result.payload.destinationIds).toEqual([
        PROJECT_EMAIL_DESTINATION_ID,
      ]);
    }
  });

  it("requires name, conditions, and destinations", () => {
    expect(validateAlertRuleDraft(createDefaultAlertRuleDraft()).ok).toBe(
      false
    );
    expect(
      validateAlertRuleDraft({
        ...createDefaultAlertRuleDraft(),
        name: "x",
        destinationIds: [],
      }).ok
    ).toBe(false);
    expect(
      validateAlertRuleDraft({
        ...createDefaultAlertRuleDraft(),
        name: "x",
        conditions: [],
      }).ok
    ).toBe(false);
  });

  it("accepts multiple ERROR_COUNT conditions", () => {
    const draft = createDefaultAlertRuleDraft();
    draft.name = "Multi";
    draft.conditions = [
      createEmptyErrorCountCondition({
        threshold: 10,
        windowMinutes: 15,
        environment: "production",
      }),
      createEmptyErrorCountCondition({
        threshold: 100,
        windowMinutes: 60,
        environment: "",
      }),
    ];
    const result = validateAlertRuleDraft(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.conditions).toEqual([
        {
          type: "ERROR_COUNT",
          threshold: 10,
          windowMinutes: 15,
          environment: "production",
        },
        {
          type: "ERROR_COUNT",
          threshold: 100,
          windowMinutes: 60,
          environment: null,
        },
      ]);
    }
  });

  it("rejects more than MAX_ALERT_RULE_CONDITIONS", () => {
    const draft = createDefaultAlertRuleDraft();
    draft.name = "Too many";
    draft.conditions = Array.from({ length: MAX_ALERT_RULE_CONDITIONS + 1 }, () =>
      createEmptyErrorCountCondition()
    );
    const result = validateAlertRuleDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/At most/);
    }
  });
});

describe("draftFromAlertRule", () => {
  it("seeds a default condition when the rule has none", () => {
    const draft = draftFromAlertRule({
      ...baseRule,
      conditions: [],
    });
    expect(draft.conditions).toHaveLength(1);
    expect(draft.conditions[0]?.type).toBe("ERROR_COUNT");
  });
});
