/**
 * Configurable alert rules (#493).
 *
 * Separation of concerns:
 * - Alert Rules own Condition[] (AND) + opaque destinationIds + cooldown/dedupe.
 * - Notifications (v1.14) own delivery — rules only call fireProjectAlert / enqueue paths.
 * - destinationIds are opaque bindings (well-known "project-email" or ProjectWebhook ids);
 *   providers (Slack/Discord/…) are resolved by Notifications, not stored as rule enums.
 */
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  fireProjectAlert,
  type AlertFireDestinations,
} from "./alert-dispatch.js";

export const MAX_ALERT_RULES = 20;
export const MAX_CONDITIONS_PER_RULE = 8;
export const MAX_DESTINATIONS_PER_RULE = 20;

/**
 * Opaque destination id for project alert email fan-out.
 * Resolved by Notifications via fireProjectAlert — not a provider enum on the rule.
 */
export const PROJECT_EMAIL_DESTINATION_ID = "project-email";

export type ErrorCountCondition = {
  type: "ERROR_COUNT";
  /** Minimum error occurrences in the window to fire. */
  threshold: number;
  windowMinutes: number;
  /** When set, only count occurrences with this environment at ingest time. */
  environment: string | null;
};

/** Discriminated condition union — add kinds as evaluators ship. */
export type AlertRuleCondition = ErrorCountCondition;

export type AlertRulePublic = {
  id: string;
  name: string;
  enabled: boolean;
  /** AND semantics: every condition must match. */
  conditions: AlertRuleCondition[];
  /** Opaque destination ids (Notifications resolves providers). */
  destinationIds: string[];
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

const errorCountConditionSchema = z.object({
  type: z.literal("ERROR_COUNT"),
  threshold: z.number().int().min(1).max(10_000),
  windowMinutes: z.number().int().min(5).max(24 * 60),
  environment: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? null : v)),
});

const conditionSchema = z.discriminatedUnion("type", [errorCountConditionSchema]);

const conditionsSchema = z
  .array(conditionSchema)
  .min(1)
  .max(MAX_CONDITIONS_PER_RULE);

const destinationIdSchema = z.union([
  z.literal(PROJECT_EMAIL_DESTINATION_ID),
  z.string().uuid(),
]);

const destinationIdsSchema = z
  .array(destinationIdSchema)
  .max(MAX_DESTINATIONS_PER_RULE)
  .transform((ids) => [...new Set(ids)]);

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional().default(true),
  conditions: conditionsSchema,
  destinationIds: destinationIdsSchema,
  cooldownMinutes: z.number().int().min(5).max(24 * 60).optional().default(15),
});

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    conditions: conditionsSchema.optional(),
    destinationIds: destinationIdsSchema.optional(),
    cooldownMinutes: z.number().int().min(5).max(24 * 60).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

/** Map opaque destinationIds → fireProjectAlert destination filters (Notifications boundary). */
export function resolveDestinationIds(
  destinationIds: string[]
): AlertFireDestinations {
  const unique = [...new Set(destinationIds)];
  return {
    email: unique.includes(PROJECT_EMAIL_DESTINATION_ID),
    webhookIds: unique.filter((id) => id !== PROJECT_EMAIL_DESTINATION_ID),
  };
}

function normalizeCondition(
  c: z.infer<typeof conditionSchema>
): AlertRuleCondition {
  return {
    type: "ERROR_COUNT",
    threshold: c.threshold,
    windowMinutes: c.windowMinutes,
    environment: c.environment ?? null,
  };
}

function toPublic(row: {
  id: string;
  name: string;
  enabled: boolean;
  conditions: unknown;
  destination_ids: unknown;
  cooldown_minutes: number;
  created_at: Date;
  updated_at: Date;
}): AlertRulePublic {
  const conditionsParsed = conditionsSchema.safeParse(row.conditions);
  const destinationIdsParsed = destinationIdsSchema.safeParse(row.destination_ids);
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    // Invalid / unknown condition JSON must not synthesize a default spike —
    // evaluation skips empty conditions (same as unimplemented types).
    conditions: conditionsParsed.success
      ? conditionsParsed.data.map(normalizeCondition)
      : [],
    destinationIds: destinationIdsParsed.success ? destinationIdsParsed.data : [],
    cooldownMinutes: row.cooldown_minutes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function webhookIdsFromDestinationIds(destinationIds: string[]): string[] {
  return [
    ...new Set(
      destinationIds.filter((id) => id !== PROJECT_EMAIL_DESTINATION_ID)
    ),
  ];
}

async function assertWebhookDestinationIdsBelongToProject(
  prisma: PrismaClient | Prisma.TransactionClient,
  projectId: string,
  destinationIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const webhookIds = webhookIdsFromDestinationIds(destinationIds);
  if (webhookIds.length === 0) return { ok: true };
  const found = await prisma.projectWebhook.count({
    where: {
      project_id: projectId,
      deleted_at: null,
      id: { in: webhookIds },
    },
  });
  if (found !== webhookIds.length) {
    return { ok: false, error: "One or more destinations were not found" };
  }
  return { ok: true };
}

export async function listAlertRules(
  prisma: PrismaClient,
  projectId: string
): Promise<AlertRulePublic[]> {
  const rows = await prisma.alertRule.findMany({
    where: { project_id: projectId, deleted_at: null },
    orderBy: { created_at: "asc" },
  });
  return rows.map(toPublic);
}

export async function createAlertRule(
  prisma: PrismaClient,
  projectId: string,
  body: unknown
): Promise<
  | { ok: true; rule: AlertRulePublic }
  | { ok: false; error: string; status: 400 | 404 | 409 }
> {
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid alert rule payload", status: 400 };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: { id: true },
  });
  if (!project) {
    return { ok: false, error: "Project not found", status: 404 };
  }

  const destCheck = await assertWebhookDestinationIdsBelongToProject(
    prisma,
    projectId,
    parsed.data.destinationIds
  );
  if (!destCheck.ok) {
    return { ok: false, error: destCheck.error, status: 400 };
  }

  const conditions = parsed.data.conditions.map(normalizeCondition);

  try {
    const row = await prisma.$transaction(
      async (tx) => {
        const count = await tx.alertRule.count({
          where: { project_id: projectId, deleted_at: null },
        });
        if (count >= MAX_ALERT_RULES) {
          const err = new Error("MAX_ALERT_RULES") as Error & { code: string };
          err.code = "MAX_ALERT_RULES";
          throw err;
        }
        return tx.alertRule.create({
          data: {
            id: randomUUID(),
            project_id: projectId,
            name: parsed.data.name,
            enabled: parsed.data.enabled,
            conditions,
            destination_ids: parsed.data.destinationIds,
            cooldown_minutes: parsed.data.cooldownMinutes,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
    return { ok: true, rule: toPublic(row) };
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "MAX_ALERT_RULES"
    ) {
      return {
        ok: false,
        error: `At most ${MAX_ALERT_RULES} alert rules per project`,
        status: 409,
      };
    }
    throw e;
  }
}

export async function updateAlertRule(
  prisma: PrismaClient,
  projectId: string,
  ruleId: string,
  body: unknown
): Promise<
  | { ok: true; rule: AlertRulePublic }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid alert rule patch", status: 400 };
  }

  const existing = await prisma.alertRule.findFirst({
    where: { id: ruleId, project_id: projectId, deleted_at: null },
  });
  if (!existing) {
    return { ok: false, error: "Alert rule not found", status: 404 };
  }

  if (parsed.data.destinationIds) {
    const destCheck = await assertWebhookDestinationIdsBelongToProject(
      prisma,
      projectId,
      parsed.data.destinationIds
    );
    if (!destCheck.ok) {
      return { ok: false, error: destCheck.error, status: 400 };
    }
  }

  const data: Prisma.AlertRuleUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.cooldownMinutes !== undefined) {
    data.cooldown_minutes = parsed.data.cooldownMinutes;
  }
  if (parsed.data.conditions !== undefined) {
    data.conditions = parsed.data.conditions.map(normalizeCondition);
  }
  if (parsed.data.destinationIds !== undefined) {
    data.destination_ids = parsed.data.destinationIds;
  }

  const row = await prisma.alertRule.update({
    where: { id: ruleId },
    data,
  });
  return { ok: true, rule: toPublic(row) };
}

export async function softDeleteAlertRule(
  prisma: PrismaClient,
  projectId: string,
  ruleId: string
): Promise<{ ok: true } | { ok: false; error: string; status: 404 }> {
  const result = await prisma.alertRule.updateMany({
    where: { id: ruleId, project_id: projectId, deleted_at: null },
    data: { deleted_at: new Date(), enabled: false },
  });
  if (result.count === 0) {
    return { ok: false, error: "Alert rule not found", status: 404 };
  }
  return { ok: true };
}

/**
 * Drop a deleted webhook destination id from every live rule so bindings stay honest.
 */
export async function pruneDestinationIdFromAlertRules(
  prisma: PrismaClient | Prisma.TransactionClient,
  projectId: string,
  destinationId: string
): Promise<number> {
  if (destinationId === PROJECT_EMAIL_DESTINATION_ID) return 0;
  const rules = await prisma.alertRule.findMany({
    where: { project_id: projectId, deleted_at: null },
    select: { id: true, destination_ids: true },
  });
  let updated = 0;
  for (const rule of rules) {
    const parsed = destinationIdsSchema.safeParse(rule.destination_ids);
    if (!parsed.success) continue;
    if (!parsed.data.includes(destinationId)) continue;
    const destinationIds = parsed.data.filter((id) => id !== destinationId);
    await prisma.alertRule.update({
      where: { id: rule.id },
      data: { destination_ids: destinationIds },
    });
    updated += 1;
  }
  return updated;
}

/** Bucket key so the same rule fires at most once per cooldown window. */
export function alertRuleDedupeKey(
  ruleId: string,
  cooldownMinutes: number,
  now = Date.now()
): string {
  const bucketMs = cooldownMinutes * 60 * 1000;
  const bucket = Math.floor(now / bucketMs);
  return `alert:rule:${ruleId}:${cooldownMinutes}:${bucket}`;
}

async function evaluateErrorCountCondition(
  prisma: PrismaClient,
  projectId: string,
  condition: ErrorCountCondition
): Promise<{ ok: true; count: number } | { ok: false }> {
  const { threshold, windowMinutes, environment } = condition;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await prisma.errorOccurrence.count({
    where: {
      created_at: { gte: since },
      ...(environment ? { environment } : {}),
      error_group: {
        project_id: projectId,
      },
    },
  });

  if (count < threshold) return { ok: false };
  return { ok: true, count };
}

/**
 * Evaluate one rule: AND all conditions, then fire via Notifications dispatch.
 * Unknown condition types skip the whole rule (cannot satisfy AND safely).
 */
async function evaluateAlertRule(
  prisma: PrismaClient,
  projectId: string,
  rule: AlertRulePublic
): Promise<boolean> {
  if (rule.conditions.length === 0) return false;

  const summaryParts: string[] = [];
  for (const condition of rule.conditions) {
    if (condition.type === "ERROR_COUNT") {
      const result = await evaluateErrorCountCondition(prisma, projectId, condition);
      if (!result.ok) return false;
      const envLabel = condition.environment ? ` in ${condition.environment}` : "";
      summaryParts.push(
        `${result.count.toLocaleString()} errors in the last ${condition.windowMinutes} minutes${envLabel} (threshold ${condition.threshold})`
      );
      continue;
    }
    // Future condition types: skip rule until an evaluator is implemented.
    return false;
  }

  const dedupeKey = alertRuleDedupeKey(rule.id, rule.cooldownMinutes);
  return fireProjectAlert(prisma, {
    projectId,
    rule: "ALERT_RULE",
    dedupeKey,
    title: rule.name,
    body: `${summaryParts.join("; ")}.`,
    href: "/dashboard/errors",
    destinations: resolveDestinationIds(rule.destinationIds),
  });
}

/**
 * Evaluate enabled custom alert rules for a project (ingest-triggered).
 * Unknown / unimplemented / unparsable conditions cause that rule to be skipped.
 */
export async function maybeEvaluateAlertRules(
  prisma: PrismaClient,
  projectId: string
): Promise<void> {
  const rules = await listAlertRules(prisma, projectId);
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.conditions.length === 0) continue;
    await evaluateAlertRule(prisma, projectId, rule);
  }
}
