import { beforeEach, describe, expect, it, vi } from "vitest";

const runScheduledAlertRuleEvaluation = vi.fn(async () => ({
  projectsScanned: 2,
  rulesEvaluated: 3,
  rulesFired: 1,
}));

vi.mock("../lib/alert-rules.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/alert-rules.js")>();
  return {
    ...actual,
    runScheduledAlertRuleEvaluation: (...args: unknown[]) =>
      runScheduledAlertRuleEvaluation(...args),
  };
});

import { runAlertRulesEvaluatorSweep } from "./alert-rules-evaluator.js";

describe("runAlertRulesEvaluatorSweep", () => {
  beforeEach(() => {
    runScheduledAlertRuleEvaluation.mockClear();
  });

  it("runs scheduled evaluation and reports the configured interval", async () => {
    const prisma = {} as never;
    const result = await runAlertRulesEvaluatorSweep(prisma, {
      ALERT_RULES_SCHEDULE_INTERVAL_MINUTES: "10",
    });
    expect(runScheduledAlertRuleEvaluation).toHaveBeenCalledWith(prisma);
    expect(result).toEqual({
      projectsScanned: 2,
      rulesEvaluated: 3,
      rulesFired: 1,
      intervalMinutes: 10,
    });
  });
});
