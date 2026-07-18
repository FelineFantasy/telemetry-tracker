/**
 * System-managed AlertRule rows for built-in error-spike and quota alerts (#535).
 *
 * Canonical representation: AlertRule (source=SYSTEM, stable migration_key).
 * Project.alert_settings remains a dual-write projection for email recipients and
 * mixed-version readers. Built-in evaluators (maybeNotifyErrorSpike / maybeNotifyQuotaAlerts)
 * read thresholds via loadProjectAlertSettings (which prefers SYSTEM rules) and still fire
 * through fireProjectAlert with legacy AlertRuleType + dedupe keys so migration cannot
 * re-fire already-sent alerts and custom evaluators cannot double-notify.
 *
 * SYSTEM condition `type` values are `BUILTIN_*` (not ERROR_COUNT / QUOTA_PERCENT) so older
 * API pods that list all AlertRule rows skip them as unknown — preventing dual-fire with
 * `ALERT_RULE` + `alert:rule:…` keys during mixed deploy.
 *
 * Custom alert-rules CRUD / ingest+scheduled evaluators skip SYSTEM rows.
 * ensure/upsert runs on alert-settings PATCH and explicit backfill only (not on every read).
 */
import { randomUUID } from "node:crypto";
import type { AlertRuleSystemKind, Prisma, PrismaClient } from "@prisma/client";
import {
  DEFAULT_PROJECT_ALERT_SETTINGS,
  parseProjectAlertSettings,
  type ProjectAlertSettings,
} from "./project-alert-settings.js";

/** Placeholder binding; SYSTEM evaluators omit destinations → legacy all-channel fan-out. */
const SYSTEM_DESTINATION_PLACEHOLDER = "project-email";

/** Condition types unknown to CUSTOM evaluators — mixed-deploy safe. */
export const BUILTIN_CONDITION_TYPES = {
  ERROR_SPIKE: "BUILTIN_ERROR_SPIKE",
  QUOTA_WARNING: "BUILTIN_QUOTA_WARNING",
  QUOTA_EXCEEDED: "BUILTIN_QUOTA_EXCEEDED",
} as const;

export const BUILTIN_MIGRATION_KEYS = {
  ERROR_SPIKE: "builtin:error_spike",
  QUOTA_WARNING: "builtin:quota_warning",
  QUOTA_EXCEEDED: "builtin:quota_exceeded",
} as const;

export type BuiltinMigrationKey =
  (typeof BUILTIN_MIGRATION_KEYS)[keyof typeof BUILTIN_MIGRATION_KEYS];

const BUILTIN_NAMES: Record<AlertRuleSystemKind, string> = {
  ERROR_SPIKE: "Error spike",
  QUOTA_WARNING: "Quota warning",
  QUOTA_EXCEEDED: "Quota exceeded",
};

type BuiltinSpec = {
  systemKind: AlertRuleSystemKind;
  migrationKey: BuiltinMigrationKey;
  name: string;
  enabled: boolean;
  cooldownMinutes: number;
  conditions: Prisma.InputJsonValue;
};

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}

function errorSpikeSpec(settings: ProjectAlertSettings): BuiltinSpec {
  const { enabled, threshold, windowMinutes } = settings.errorSpike;
  return {
    systemKind: "ERROR_SPIKE",
    migrationKey: BUILTIN_MIGRATION_KEYS.ERROR_SPIKE,
    name: BUILTIN_NAMES.ERROR_SPIKE,
    enabled,
    cooldownMinutes: windowMinutes,
    conditions: [
      {
        type: BUILTIN_CONDITION_TYPES.ERROR_SPIKE,
        threshold,
        windowMinutes,
      },
    ],
  };
}

function quotaWarningSpec(settings: ProjectAlertSettings): BuiltinSpec {
  const { enabled, nearPercent } = settings.quota;
  return {
    systemKind: "QUOTA_WARNING",
    migrationKey: BUILTIN_MIGRATION_KEYS.QUOTA_WARNING,
    name: BUILTIN_NAMES.QUOTA_WARNING,
    enabled,
    // Monthly dedupe keys own cooldown; claim path is unused for SYSTEM quota.
    cooldownMinutes: 60,
    conditions: [
      {
        type: BUILTIN_CONDITION_TYPES.QUOTA_WARNING,
        thresholdPercent: nearPercent,
      },
    ],
  };
}

function quotaExceededSpec(): BuiltinSpec {
  return {
    systemKind: "QUOTA_EXCEEDED",
    migrationKey: BUILTIN_MIGRATION_KEYS.QUOTA_EXCEEDED,
    name: BUILTIN_NAMES.QUOTA_EXCEEDED,
    // Exceeded always fires when usage ≥ limit (legacy semantics).
    enabled: true,
    cooldownMinutes: 60,
    conditions: [
      {
        type: BUILTIN_CONDITION_TYPES.QUOTA_EXCEEDED,
      },
    ],
  };
}

/** Build the three SYSTEM rule specs from parsed alert_settings (or defaults). */
export function builtinSpecsFromSettings(
  settings: ProjectAlertSettings
): BuiltinSpec[] {
  return [errorSpikeSpec(settings), quotaWarningSpec(settings), quotaExceededSpec()];
}

function errorSpikeFromConditions(
  enabled: boolean,
  conditions: unknown
): ProjectAlertSettings["errorSpike"] | null {
  if (!Array.isArray(conditions) || conditions.length === 0) return null;
  const c = conditions[0];
  if (typeof c !== "object" || c === null) return null;
  const type = (c as { type?: unknown }).type;
  // Accept BUILTIN_* (current) and legacy ERROR_COUNT if a row was written early.
  if (type !== BUILTIN_CONDITION_TYPES.ERROR_SPIKE && type !== "ERROR_COUNT") {
    return null;
  }
  const threshold = (c as { threshold?: unknown }).threshold;
  const windowMinutes = (c as { windowMinutes?: unknown }).windowMinutes;
  if (
    typeof threshold !== "number" ||
    !Number.isInteger(threshold) ||
    threshold < 1 ||
    threshold > 10_000
  ) {
    return null;
  }
  if (
    typeof windowMinutes !== "number" ||
    !Number.isInteger(windowMinutes) ||
    windowMinutes < 5 ||
    windowMinutes > 24 * 60
  ) {
    return null;
  }
  return { enabled, threshold, windowMinutes };
}

function quotaWarningFromConditions(
  enabled: boolean,
  conditions: unknown
): ProjectAlertSettings["quota"] | null {
  if (!Array.isArray(conditions) || conditions.length === 0) return null;
  const c = conditions[0];
  if (typeof c !== "object" || c === null) return null;
  const type = (c as { type?: unknown }).type;
  if (
    type !== BUILTIN_CONDITION_TYPES.QUOTA_WARNING &&
    type !== "QUOTA_PERCENT"
  ) {
    return null;
  }
  const thresholdPercent = (c as { thresholdPercent?: unknown }).thresholdPercent;
  if (
    typeof thresholdPercent !== "number" ||
    !Number.isInteger(thresholdPercent) ||
    thresholdPercent < 50 ||
    thresholdPercent > 99
  ) {
    return null;
  }
  return { enabled, nearPercent: thresholdPercent };
}

/**
 * Overlay SYSTEM rule state onto alert_settings for spike/quota fields.
 * Email settings always come from the JSON projection.
 */
export function mergeSettingsFromBuiltinRules(
  base: ProjectAlertSettings,
  rules: Array<{
    system_kind: AlertRuleSystemKind | null;
    enabled: boolean;
    conditions: unknown;
  }>
): ProjectAlertSettings {
  let errorSpike = base.errorSpike;
  let quota = base.quota;
  for (const rule of rules) {
    if (rule.system_kind === "ERROR_SPIKE") {
      const parsed = errorSpikeFromConditions(rule.enabled, rule.conditions);
      if (parsed) errorSpike = parsed;
    } else if (rule.system_kind === "QUOTA_WARNING") {
      const parsed = quotaWarningFromConditions(rule.enabled, rule.conditions);
      if (parsed) quota = parsed;
    }
  }
  return { errorSpike, quota, email: base.email };
}

async function upsertBuiltinSpec(
  prisma: PrismaClient | Prisma.TransactionClient,
  projectId: string,
  spec: BuiltinSpec
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await prisma.alertRule.findFirst({
    where: {
      project_id: projectId,
      migration_key: spec.migrationKey,
      deleted_at: null,
    },
  });

  const destinationIds = [SYSTEM_DESTINATION_PLACEHOLDER];

  if (!existing) {
    // Soft-deleted SYSTEM row with same key: revive rather than violate unique.
    const softDeleted = await prisma.alertRule.findFirst({
      where: {
        project_id: projectId,
        migration_key: spec.migrationKey,
        deleted_at: { not: null },
      },
    });
    if (softDeleted) {
      await prisma.alertRule.update({
        where: { id: softDeleted.id },
        data: {
          name: spec.name,
          enabled: spec.enabled,
          source: "SYSTEM",
          system_kind: spec.systemKind,
          conditions: spec.conditions,
          destination_ids: destinationIds,
          cooldown_minutes: spec.cooldownMinutes,
          deleted_at: null,
        },
      });
      return "updated";
    }
    try {
      await prisma.alertRule.create({
        data: {
          id: randomUUID(),
          project_id: projectId,
          name: spec.name,
          enabled: spec.enabled,
          source: "SYSTEM",
          system_kind: spec.systemKind,
          migration_key: spec.migrationKey,
          conditions: spec.conditions,
          destination_ids: destinationIds,
          cooldown_minutes: spec.cooldownMinutes,
        },
      });
      return "created";
    } catch (e: unknown) {
      // Concurrent ensure raced on (project_id, migration_key) — treat as update path.
      if (!isUniqueViolation(e)) throw e;
      const raced = await prisma.alertRule.findFirst({
        where: {
          project_id: projectId,
          migration_key: spec.migrationKey,
        },
      });
      if (!raced) throw e;
      await prisma.alertRule.update({
        where: { id: raced.id },
        data: {
          name: spec.name,
          enabled: spec.enabled,
          source: "SYSTEM",
          system_kind: spec.systemKind,
          conditions: spec.conditions,
          destination_ids: destinationIds,
          cooldown_minutes: spec.cooldownMinutes,
          deleted_at: null,
        },
      });
      return "updated";
    }
  }

  const same =
    existing.enabled === spec.enabled &&
    existing.name === spec.name &&
    existing.source === "SYSTEM" &&
    existing.system_kind === spec.systemKind &&
    existing.cooldown_minutes === spec.cooldownMinutes &&
    JSON.stringify(existing.conditions) === JSON.stringify(spec.conditions);

  if (same) return "unchanged";

  await prisma.alertRule.update({
    where: { id: existing.id },
    data: {
      name: spec.name,
      enabled: spec.enabled,
      source: "SYSTEM",
      system_kind: spec.systemKind,
      conditions: spec.conditions,
      destination_ids: destinationIds,
      cooldown_minutes: spec.cooldownMinutes,
    },
  });
  return "updated";
}

/**
 * Idempotently create/update the three SYSTEM rules for a project from settings.
 * Call from alert-settings PATCH and the backfill job — not on every settings read
 * (avoids clobbering concurrent writes and avoids creating rows during mixed deploy reads).
 */
export async function ensureBuiltinAlertRules(
  prisma: PrismaClient | Prisma.TransactionClient,
  projectId: string,
  settings: ProjectAlertSettings = DEFAULT_PROJECT_ALERT_SETTINGS
): Promise<{ created: number; updated: number; unchanged: number }> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const spec of builtinSpecsFromSettings(settings)) {
    const result = await upsertBuiltinSpec(prisma, projectId, spec);
    if (result === "created") created += 1;
    else if (result === "updated") updated += 1;
    else unchanged += 1;
  }
  return { created, updated, unchanged };
}

/**
 * Dual-write: persist alert_settings JSON and sync SYSTEM AlertRule rows.
 */
export async function saveProjectAlertSettings(
  prisma: PrismaClient,
  projectId: string,
  settings: ProjectAlertSettings
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: { alert_settings: settings as object },
    });
    await ensureBuiltinAlertRules(tx, projectId, settings);
  });
}

/**
 * Load settings with SYSTEM AlertRule as canonical for spike/quota when present.
 * Does not create SYSTEM rows (use PATCH or backfill). Falls back to alert_settings JSON.
 */
export async function loadProjectAlertSettingsCanonical(
  prisma: PrismaClient,
  projectId: string
): Promise<ProjectAlertSettings> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: { alert_settings: true },
  });
  if (!row) {
    return parseProjectAlertSettings(null);
  }

  const fromJson = parseProjectAlertSettings(row.alert_settings);

  const systemRules = await prisma.alertRule.findMany({
    where: {
      project_id: projectId,
      deleted_at: null,
      source: "SYSTEM",
    },
    select: {
      system_kind: true,
      enabled: true,
      conditions: true,
    },
  });

  if (systemRules.length === 0) {
    return fromJson;
  }

  return mergeSettingsFromBuiltinRules(fromJson, systemRules);
}

export type BuiltinAlertRulesBackfillResult = {
  projectsScanned: number;
  projectsUpdated: number;
  rulesCreated: number;
  rulesUpdated: number;
  rulesUnchanged: number;
  failures: number;
};

/**
 * Backfill SYSTEM AlertRule rows for every non-deleted project.
 * Idempotent — re-running only updates drift / creates missing rows.
 */
export async function backfillBuiltinAlertRules(
  prisma: PrismaClient,
  options: {
    dryRun?: boolean;
    onProgress?: (message: string) => void;
  } = {}
): Promise<BuiltinAlertRulesBackfillResult> {
  const dryRun = options.dryRun === true;
  const projects = await prisma.project.findMany({
    where: { deleted_at: null },
    select: { id: true, alert_settings: true },
    orderBy: { created_at: "asc" },
  });

  const result: BuiltinAlertRulesBackfillResult = {
    projectsScanned: projects.length,
    projectsUpdated: 0,
    rulesCreated: 0,
    rulesUpdated: 0,
    rulesUnchanged: 0,
    failures: 0,
  };

  for (const project of projects) {
    const settings = parseProjectAlertSettings(project.alert_settings);
    try {
      if (dryRun) {
        const existing = await prisma.alertRule.findMany({
          where: {
            project_id: project.id,
            migration_key: { in: Object.values(BUILTIN_MIGRATION_KEYS) },
            deleted_at: null,
          },
          select: { migration_key: true },
        });
        const have = new Set(existing.map((r) => r.migration_key));
        const missing = Object.values(BUILTIN_MIGRATION_KEYS).filter(
          (k) => !have.has(k)
        );
        if (missing.length > 0) {
          result.projectsUpdated += 1;
          result.rulesCreated += missing.length;
        }
        options.onProgress?.(
          `dry-run project=${project.id} missing=${missing.length}`
        );
        continue;
      }

      const counts = await ensureBuiltinAlertRules(prisma, project.id, settings);
      result.rulesCreated += counts.created;
      result.rulesUpdated += counts.updated;
      result.rulesUnchanged += counts.unchanged;
      if (counts.created > 0 || counts.updated > 0) {
        result.projectsUpdated += 1;
      }
      options.onProgress?.(
        `project=${project.id} created=${counts.created} updated=${counts.updated}`
      );
    } catch (e) {
      result.failures += 1;
      const message = e instanceof Error ? e.message : String(e);
      options.onProgress?.(`FAIL project=${project.id}: ${message}`);
    }
  }

  return result;
}
