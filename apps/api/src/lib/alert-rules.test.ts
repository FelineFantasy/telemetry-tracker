import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  alertRuleDedupeKey,
  createAlertRule,
  MAX_ALERT_RULES,
  maybeEvaluateAlertRules,
  PROJECT_EMAIL_DESTINATION_ID,
  pruneDestinationIdFromAlertRules,
  resolveDestinationIds,
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

describe("resolveDestinationIds", () => {
  it("maps opaque ids to Notifications fire filters", () => {
    expect(
      resolveDestinationIds([
        PROJECT_EMAIL_DESTINATION_ID,
        "22222222-2222-2222-2222-222222222222",
      ])
    ).toEqual({
      email: true,
      webhookIds: ["22222222-2222-2222-2222-222222222222"],
    });
    expect(resolveDestinationIds([])).toEqual({ email: false, webhookIds: [] });
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

  it("rejects destination ids outside the project", async () => {
    const prisma = {
      project: { findFirst: async () => ({ id: "p1" }) },
      projectWebhook: { count: async () => 0 },
    } as never;
    const result = await createAlertRule(prisma, "p1", {
      name: "Prod spike",
      conditions: [
        {
          type: "ERROR_COUNT",
          threshold: 10,
          windowMinutes: 15,
          environment: "production",
        },
      ],
      destinationIds: ["11111111-1111-1111-1111-111111111111"],
    });
    expect(result).toEqual({
      ok: false,
      error: "One or more destinations were not found",
      status: 400,
    });
  });

  it("creates a rule when under the cap", async () => {
    const created = {
      id: "rule-1",
      name: "Prod spike",
      enabled: true,
      conditions: [
        {
          type: "ERROR_COUNT" as const,
          threshold: 10,
          windowMinutes: 15,
          environment: "production",
        },
      ],
      destination_ids: [PROJECT_EMAIL_DESTINATION_ID] as string[],
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
      conditions: [
        {
          type: "ERROR_COUNT",
          threshold: 10,
          windowMinutes: 15,
          environment: "production",
        },
      ],
      destinationIds: [PROJECT_EMAIL_DESTINATION_ID],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rule.name).toBe("Prod spike");
      expect(result.rule.conditions[0]?.environment).toBe("production");
      expect(result.rule.destinationIds).toEqual([PROJECT_EMAIL_DESTINATION_ID]);
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
      conditions: [{ type: "ERROR_COUNT", threshold: 5, windowMinutes: 10 }],
      destinationIds: [],
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
      conditions: [
        {
          type: "ERROR_COUNT" as const,
          threshold: 10,
          windowMinutes: 15,
          environment: null,
        },
      ],
      destination_ids: [PROJECT_EMAIL_DESTINATION_ID],
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

describe("pruneDestinationIdFromAlertRules", () => {
  it("removes the destination id from destinationIds", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = {
      alertRule: {
        findMany: async () => [
          {
            id: "rule-1",
            destination_ids: [
              PROJECT_EMAIL_DESTINATION_ID,
              "22222222-2222-2222-2222-222222222222",
              "33333333-3333-3333-3333-333333333333",
            ],
          },
          {
            id: "rule-2",
            destination_ids: [],
          },
        ],
        update,
      },
    } as never;

    const n = await pruneDestinationIdFromAlertRules(
      prisma,
      "p1",
      "22222222-2222-2222-2222-222222222222"
    );
    expect(n).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: {
        destination_ids: [
          PROJECT_EMAIL_DESTINATION_ID,
          "33333333-3333-3333-3333-333333333333",
        ],
      },
    });
  });
});

describe("maybeEvaluateAlertRules", () => {
  beforeEach(() => {
    fireProjectAlert.mockClear();
    fireProjectAlert.mockResolvedValue(true);
  });

  it("fires when all AND conditions match with destination binding", async () => {
    const ruleRow = {
      id: "rule-1",
      name: "Prod errors",
      enabled: true,
      conditions: [
        {
          type: "ERROR_COUNT" as const,
          threshold: 5,
          windowMinutes: 15,
          environment: "production",
        },
      ],
      destination_ids: ["22222222-2222-2222-2222-222222222222"],
      cooldown_minutes: 15,
      created_at: new Date("2026-07-17T00:00:00.000Z"),
      updated_at: new Date("2026-07-17T00:00:00.000Z"),
    };
    const count = vi.fn(async () => 12);
    const prisma = {
      alertRule: {
        findMany: async () => [ruleRow],
      },
      errorOccurrence: { count },
    } as never;

    await maybeEvaluateAlertRules(prisma, "p1");

    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        environment: "production",
        error_group: { project_id: "p1" },
      }),
    });
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
            conditions: [
              {
                type: "ERROR_COUNT",
                threshold: 1,
                windowMinutes: 15,
                environment: null,
              },
            ],
            destination_ids: [PROJECT_EMAIL_DESTINATION_ID],
            cooldown_minutes: 15,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: "rule-low",
            name: "Low",
            enabled: true,
            conditions: [
              {
                type: "ERROR_COUNT",
                threshold: 100,
                windowMinutes: 15,
                environment: null,
              },
            ],
            destination_ids: [PROJECT_EMAIL_DESTINATION_ID],
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
