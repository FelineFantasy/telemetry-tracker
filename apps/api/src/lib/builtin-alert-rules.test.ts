import { beforeEach, describe, expect, it } from "vitest";
import {
  BUILTIN_MIGRATION_KEYS,
  backfillBuiltinAlertRules,
  builtinSpecsFromSettings,
  ensureBuiltinAlertRules,
  mergeSettingsFromBuiltinRules,
} from "./builtin-alert-rules.js";
import {
  DEFAULT_PROJECT_ALERT_SETTINGS,
  type ProjectAlertSettings,
} from "./project-alert-settings.js";

function settings(partial: {
  errorSpike?: Partial<ProjectAlertSettings["errorSpike"]>;
  quota?: Partial<ProjectAlertSettings["quota"]>;
}): ProjectAlertSettings {
  return {
    errorSpike: { ...DEFAULT_PROJECT_ALERT_SETTINGS.errorSpike, ...partial.errorSpike },
    quota: { ...DEFAULT_PROJECT_ALERT_SETTINGS.quota, ...partial.quota },
    email: { ...DEFAULT_PROJECT_ALERT_SETTINGS.email },
  };
}

describe("builtinSpecsFromSettings", () => {
  it("maps error-spike and quota warning; quota exceeded is always enabled", () => {
    const specs = builtinSpecsFromSettings(
      settings({
        errorSpike: { enabled: false, threshold: 10, windowMinutes: 30 },
        quota: { enabled: false, nearPercent: 80 },
      })
    );
    expect(specs).toHaveLength(3);
    expect(specs[0]).toMatchObject({
      systemKind: "ERROR_SPIKE",
      migrationKey: BUILTIN_MIGRATION_KEYS.ERROR_SPIKE,
      enabled: false,
      cooldownMinutes: 30,
    });
    expect(specs[0].conditions).toEqual([
      {
        type: "BUILTIN_ERROR_SPIKE",
        threshold: 10,
        windowMinutes: 30,
      },
    ]);
    expect(specs[1]).toMatchObject({
      systemKind: "QUOTA_WARNING",
      enabled: false,
    });
    expect(specs[1].conditions).toEqual([
      { type: "BUILTIN_QUOTA_WARNING", thresholdPercent: 80 },
    ]);
    expect(specs[2]).toMatchObject({
      systemKind: "QUOTA_EXCEEDED",
      enabled: true,
      migrationKey: BUILTIN_MIGRATION_KEYS.QUOTA_EXCEEDED,
    });
    expect(specs[2].conditions).toEqual([
      { type: "BUILTIN_QUOTA_EXCEEDED" },
    ]);
  });
});

describe("mergeSettingsFromBuiltinRules", () => {
  it("overlays spike/quota from SYSTEM rules and preserves email", () => {
    const base = settings({
      errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
      quota: { enabled: true, nearPercent: 90 },
    });
    const merged = mergeSettingsFromBuiltinRules(base, [
      {
        system_kind: "ERROR_SPIKE",
        enabled: false,
        conditions: [
          {
            type: "BUILTIN_ERROR_SPIKE",
            threshold: 40,
            windowMinutes: 20,
          },
        ],
      },
      {
        system_kind: "QUOTA_WARNING",
        enabled: true,
        conditions: [{ type: "BUILTIN_QUOTA_WARNING", thresholdPercent: 75 }],
      },
      {
        system_kind: "QUOTA_EXCEEDED",
        enabled: true,
        conditions: [{ type: "BUILTIN_QUOTA_EXCEEDED" }],
      },
    ]);
    expect(merged.errorSpike).toEqual({
      enabled: false,
      threshold: 40,
      windowMinutes: 20,
    });
    expect(merged.quota).toEqual({ enabled: true, nearPercent: 75 });
    expect(merged.email).toEqual(base.email);
  });

  it("keeps base spike/quota when SYSTEM conditions are invalid", () => {
    const base = settings({});
    const merged = mergeSettingsFromBuiltinRules(base, [
      {
        system_kind: "ERROR_SPIKE",
        enabled: false,
        conditions: [{ type: "HEARTBEAT", windowMinutes: 15 }],
      },
    ]);
    expect(merged.errorSpike).toEqual(base.errorSpike);
  });
});

describe("ensureBuiltinAlertRules", () => {
  const store = new Map<
    string,
    {
      id: string;
      project_id: string;
      migration_key: string | null;
      deleted_at: Date | null;
      enabled: boolean;
      name: string;
      source: string;
      system_kind: string | null;
      conditions: unknown;
      destination_ids: unknown;
      cooldown_minutes: number;
    }
  >();

  const prisma = {
    alertRule: {
      findFirst: async ({
        where,
      }: {
        where: {
          project_id: string;
          migration_key: string;
          deleted_at: null | { not: null };
        };
      }) => {
        for (const row of store.values()) {
          if (row.project_id !== where.project_id) continue;
          if (row.migration_key !== where.migration_key) continue;
          if (where.deleted_at === null && row.deleted_at !== null) continue;
          if (
            where.deleted_at &&
            typeof where.deleted_at === "object" &&
            "not" in where.deleted_at &&
            row.deleted_at === null
          ) {
            continue;
          }
          return row;
        }
        return null;
      },
      create: async ({ data }: { data: (typeof store extends Map<string, infer V> ? V : never) }) => {
        store.set(data.id, { ...data, deleted_at: null });
        return data;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = store.get(where.id);
        if (!row) throw new Error("missing");
        const next = { ...row, ...data };
        store.set(where.id, next as typeof row);
        return next;
      },
    },
  };

  beforeEach(() => {
    store.clear();
  });

  it("creates three SYSTEM rules then is a no-op on second run", async () => {
    const first = await ensureBuiltinAlertRules(
      prisma as never,
      "p1",
      settings({ errorSpike: { enabled: false } })
    );
    expect(first).toEqual({ created: 3, updated: 0, unchanged: 0 });
    expect(store.size).toBe(3);

    const second = await ensureBuiltinAlertRules(
      prisma as never,
      "p1",
      settings({ errorSpike: { enabled: false } })
    );
    expect(second).toEqual({ created: 0, updated: 0, unchanged: 3 });
    expect(store.size).toBe(3);
  });

  it("updates when settings drift and does not duplicate", async () => {
    await ensureBuiltinAlertRules(prisma as never, "p1", settings({}));
    const again = await ensureBuiltinAlertRules(
      prisma as never,
      "p1",
      settings({
        errorSpike: { enabled: true, threshold: 50, windowMinutes: 60 },
        quota: { enabled: false, nearPercent: 95 },
      })
    );
    expect(again.created).toBe(0);
    expect(again.updated).toBeGreaterThanOrEqual(2);
    expect(store.size).toBe(3);
    const spike = [...store.values()].find(
      (r) => r.migration_key === BUILTIN_MIGRATION_KEYS.ERROR_SPIKE
    );
    expect(spike?.conditions).toEqual([
      {
        type: "BUILTIN_ERROR_SPIKE",
        threshold: 50,
        windowMinutes: 60,
      },
    ]);
  });

  it("revives soft-deleted SYSTEM rows instead of creating duplicates", async () => {
    await ensureBuiltinAlertRules(prisma as never, "p1", settings({}));
    const spike = [...store.values()].find(
      (r) => r.migration_key === BUILTIN_MIGRATION_KEYS.ERROR_SPIKE
    )!;
    spike.deleted_at = new Date();
    const result = await ensureBuiltinAlertRules(prisma as never, "p1", settings({}));
    expect(result.created).toBe(0);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(store.size).toBe(3);
    const revived = store.get(spike.id);
    expect(revived?.deleted_at).toBeNull();
  });
});

describe("backfillBuiltinAlertRules", () => {
  it("scans projects and reports dry-run missing rules", async () => {
    const prisma = {
      project: {
        findMany: async () => [
          { id: "p1", alert_settings: null },
          { id: "p2", alert_settings: null },
        ],
      },
      alertRule: {
        findMany: async () => [],
      },
    };
    const result = await backfillBuiltinAlertRules(prisma as never, {
      dryRun: true,
    });
    expect(result.projectsScanned).toBe(2);
    expect(result.projectsUpdated).toBe(2);
    expect(result.rulesCreated).toBe(6);
    expect(result.failures).toBe(0);
  });
});

describe("legacy vs SYSTEM evaluator dual-path (dedupe identity)", () => {
  it("documents that built-in fires keep legacy dedupe key shapes", async () => {
    const { errorSpikeDedupeKey } = await import("./project-alert-settings.js");
    const { quotaNotificationKey } = await import("./quota-notification-keys.js");
    expect(errorSpikeDedupeKey("p1", 15, 0)).toBe("alert:error_spike:p1:15:0");
    expect(quotaNotificationKey("p1", "near", "2026-07")).toBe(
      "quota:near:p1:2026-07"
    );
    expect(quotaNotificationKey("p1", "exceeded", "2026-07")).toBe(
      "quota:exceeded:p1:2026-07"
    );
  });
});
