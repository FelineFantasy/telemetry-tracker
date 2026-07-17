import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  alertRuleDedupeKey,
  createAlertRule,
  MAX_ALERT_RULES,
  maybeEvaluateAlertRules,
  softDeleteAlertRule,
  updateAlertRule,
} from "./alert-rules.js";

const fireProjectAlert = vi.fn(async () => true);

vi.mock("./alert-dispatch.js", () => ({
  fireProjectAlert: (...args: unknown[]) => fireProjectAlert(...args),
}));

describe("alertRuleDedupeKey", () => {
  it("buckets by cooldown window", () => {
    const t0 = Date.UTC(2026, 6, 17, 12, 0, 0);
    const t1 = t0 + 14 * 60 * 1000;
    const t2 = t0 + 15 * 60 * 1000;
    expect(alertRuleDedupeKey("r1", 15, t0)).toBe(alertRuleDedupeKey("r1", 15, t1));
    expect(alertRuleDedupeKey("r1", 15, t0)).not.toBe(alertRuleDedupeKey("r1", 15, t2));
  });
});

describe("createAlertRule", () => {
  it("rejects invalid payload", async () => {
    const prisma = { project: { findFirst: vi.fn() } } as never;
    const result = await createAlertRule(prisma, "p1", { name: "" });
    expect(result).toEqual({
      ok: false,
      error: "Invalid alert rule payload",
      status: 400,
    });
  });

  it("rejects webhook ids outside the project", async () => {
    const prisma = {
      project: { findFirst: async () => ({ id: "p1" }) },
      projectWebhook: { count: async () => 0 },
    } as never;
    const result = await createAlertRule(prisma, "p1", {
      name: "Prod spike",
      conditionType: "ERROR_COUNT",
      condition: { threshold: 10, windowMinutes: 15, environment: "production" },
      destinations: {
        email: true,
        webhookIds: ["11111111-1111-1111-1111-111111111111"],
      },
    });
    expect(result).toEqual({
      ok: false,
      error: "One or more webhook destinations were not found",
      status: 400,
    });
  });

  it("creates a rule when under the cap", async () => {
    const created = {
      id: "rule-1",
      name: "Prod spike",
      enabled: true,
      condition_type: "ERROR_COUNT" as const,
      condition: { threshold: 10, windowMinutes: 15, environment: "production" },
      destinations: { email: true, webhookIds: [] as string[] },
      cooldown_minutes: 15,
      created_at: new Date("2026-07-17T00:00:00.000Z"),
      updated_at: new Date("2026-07-17T00:00:00.000Z"),
    };
    const tx = {
      alertRule: {
        count: async () => 0,
        create: async () => created,
      },
    };
    const prisma = {
      project: { findFirst: async () => ({ id: "p1" }) },
      projectWebhook: { count: async () => 0 },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    } as never;

    const result = await createAlertRule(prisma, "p1", {
      name: "Prod spike",
      conditionType: "ERROR_COUNT",
      condition: { threshold: 10, windowMinutes: 15, environment: "production" },
      destinations: { email: true, webhookIds: [] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rule.name).toBe("Prod spike");
      expect(result.rule.condition.environment).toBe("production");
    }
  });

  it("returns 409 when at MAX_ALERT_RULES", async () => {
    const tx = {
      alertRule: {
        count: async () => MAX_ALERT_RULES,
        create: vi.fn(),
      },
    };
    const prisma = {
      project: { findFirst: async () => ({ id: "p1" }) },
      projectWebhook: { count: async () => 0 },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    } as never;

    const result = await createAlertRule(prisma, "p1", {
      name: "Overflow",
      conditionType: "ERROR_COUNT",
      condition: { threshold: 5, windowMinutes: 10 },
      destinations: { email: false, webhookIds: [] },
    });
    expect(result).toEqual({
      ok: false,
      error: `At most ${MAX_ALERT_RULES} alert rules per project`,
      status: 409,
    });
  });
});

describe("updateAlertRule / softDeleteAlertRule", () => {
  it("updates enabled flag", async () => {
    const existing = {
      id: "rule-1",
      project_id: "p1",
      name: "Prod spike",
      enabled: true,
      condition_type: "ERROR_COUNT" as const,
      condition: { threshold: 10, windowMinutes: 15, environment: null },
      destinations: { email: true, webhookIds: [] },
      cooldown_minutes: 15,
      created_at: new Date("2026-07-17T00:00:00.000Z"),
      updated_at: new Date("2026-07-17T00:00:00.000Z"),
      deleted_at: null,
    };
    const prisma = {
      alertRule: {
        findFirst: async () => existing,
        update: async ({ data }: { data: { enabled?: boolean } }) => ({
          ...existing,
          enabled: data.enabled ?? existing.enabled,
          updated_at: new Date("2026-07-17T01:00:00.000Z"),
        }),
      },
    } as never;
    const result = await updateAlertRule(prisma, "p1", "rule-1", { enabled: false });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rule.enabled).toBe(false);
  });

  it("soft-deletes a rule", async () => {
    const prisma = {
      alertRule: {
        updateMany: async () => ({ count: 1 }),
      },
    } as never;
    expect(await softDeleteAlertRule(prisma, "p1", "rule-1")).toEqual({ ok: true });
  });
});

describe("maybeEvaluateAlertRules", () => {
  beforeEach(() => {
    fireProjectAlert.mockClear();
    fireProjectAlert.mockResolvedValue(true);
  });

  it("fires ERROR_COUNT when threshold met with destination binding", async () => {
    const ruleRow = {
      id: "rule-1",
      name: "Prod errors",
      enabled: true,
      condition_type: "ERROR_COUNT" as const,
      condition: { threshold: 5, windowMinutes: 15, environment: "production" },
      destinations: {
        email: false,
        webhookIds: ["22222222-2222-2222-2222-222222222222"],
      },
      cooldown_minutes: 15,
      created_at: new Date("2026-07-17T00:00:00.000Z"),
      updated_at: new Date("2026-07-17T00:00:00.000Z"),
    };
    const prisma = {
      alertRule: {
        findMany: async () => [ruleRow],
      },
      errorOccurrence: {
        count: async () => 12,
      },
    } as never;

    await maybeEvaluateAlertRules(prisma, "p1");

    expect(fireProjectAlert).toHaveBeenCalledTimes(1);
    expect(fireProjectAlert).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        projectId: "p1",
        rule: "ALERT_RULE",
        title: "Prod errors",
        destinations: {
          email: false,
          webhookIds: ["22222222-2222-2222-2222-222222222222"],
        },
      })
    );
  });

  it("skips disabled rules and below-threshold counts", async () => {
    const prisma = {
      alertRule: {
        findMany: async () => [
          {
            id: "rule-off",
            name: "Off",
            enabled: false,
            condition_type: "ERROR_COUNT",
            condition: { threshold: 1, windowMinutes: 15, environment: null },
            destinations: { email: true, webhookIds: [] },
            cooldown_minutes: 15,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: "rule-low",
            name: "Low",
            enabled: true,
            condition_type: "ERROR_COUNT",
            condition: { threshold: 100, windowMinutes: 15, environment: null },
            destinations: { email: true, webhookIds: [] },
            cooldown_minutes: 15,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      },
      errorOccurrence: {
        count: async () => 2,
      },
    } as never;

    await maybeEvaluateAlertRules(prisma, "p1");
    expect(fireProjectAlert).not.toHaveBeenCalled();
  });
});
