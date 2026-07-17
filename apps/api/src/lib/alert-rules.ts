/**
 * Configurable alert rules (#493).
 * Condition types are extensible examples — only ERROR_COUNT is evaluated in this MVP.
 */
import { randomUUID } from "node:crypto";
import type { AlertConditionType, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { fireProjectAlert } from "./alert-dispatch.js";

export const MAX_ALERT_RULES = 20;

export type AlertRuleDestinations = {
  /** When true, fan out via project alert email settings. */
  email: boolean;
  /** Specific ProjectWebhook ids (must belong to the project). Empty = no chat/webhook delivery. */
  webhookIds: string[];
};

export type ErrorCountCondition = {
  /** Minimum error occurrences in the window to fire. */
  threshold: number;
  windowMinutes: number;
  /** When set, only count occurrences on error groups with this environment. */
  environment: string | null;
};

export type AlertRuleCondition = ErrorCountCondition;

export type AlertRulePublic = {
  id: string;
  name: string;
  enabled: boolean;
  conditionType: AlertConditionType;
  condition: AlertRuleCondition;
  destinations: AlertRuleDestinations;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

const destinationsSchema = z.object({
  email: z.boolean(),
  webhookIds: z.array(z.string().uuid()).max(MAX_ALERT_RULES),
});

const errorCountConditionSchema = z.object({
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

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional().default(true),
  conditionType: z.literal("ERROR_COUNT"),
  condition: errorCountConditionSchema,
  destinations: destinationsSchema,
  cooldownMinutes: z.number().int().min(5).max(24 * 60).optional().default(15),
});

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    conditionType: z.literal("ERROR_COUNT").optional(),
    condition: errorCountConditionSchema.optional(),
    destinations: destinationsSchema.optional(),
    cooldownMinutes: z.number().int().min(5).max(24 * 60).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

function toPublic(row: {
  id: string;
  name: string;
  enabled: boolean;
  condition_type: AlertConditionType;
  condition: unknown;
  destinations: unknown;
  cooldown_minutes: number;
  created_at: Date;
  updated_at: Date;
}): AlertRulePublic {
  const conditionParsed = errorCountConditionSchema.safeParse(row.condition);
  const destinationsParsed = destinationsSchema.safeParse(row.destinations);
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    conditionType: row.condition_type,
    condition: conditionParsed.success
      ? {
          threshold: conditionParsed.data.threshold,
          windowMinutes: conditionParsed.data.windowMinutes,
          environment: conditionParsed.data.environment ?? null,
        }
      : { threshold: 25, windowMinutes: 15, environment: null },
    destinations: destinationsParsed.success
      ? {
          email: destinationsParsed.data.email,
          webhookIds: destinationsParsed.data.webhookIds,
        }
      : { email: true, webhookIds: [] },
    cooldownMinutes: row.cooldown_minutes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function assertWebhookIdsBelongToProject(
  prisma: PrismaClient | Prisma.TransactionClient,
  projectId: string,
  webhookIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (webhookIds.length === 0) return { ok: true };
  const unique = [...new Set(webhookIds)];
  const found = await prisma.projectWebhook.count({
    where: {
      project_id: projectId,
      deleted_at: null,
      id: { in: unique },
    },
  });
  if (found !== unique.length) {
    return { ok: false, error: "One or more webhook destinations were not found" };
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

  const webhookCheck = await assertWebhookIdsBelongToProject(
    prisma,
    projectId,
    parsed.data.destinations.webhookIds
  );
  if (!webhookCheck.ok) {
    return { ok: false, error: webhookCheck.error, status: 400 };
  }

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
            condition_type: parsed.data.conditionType,
            condition: {
              threshold: parsed.data.condition.threshold,
              windowMinutes: parsed.data.condition.windowMinutes,
              environment: parsed.data.condition.environment ?? null,
            },
            destinations: {
              email: parsed.data.destinations.email,
              webhookIds: [...new Set(parsed.data.destinations.webhookIds)],
            },
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

  if (parsed.data.destinations) {
    const webhookCheck = await assertWebhookIdsBelongToProject(
      prisma,
      projectId,
      parsed.data.destinations.webhookIds
    );
    if (!webhookCheck.ok) {
      return { ok: false, error: webhookCheck.error, status: 400 };
    }
  }

  const data: Prisma.AlertRuleUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.cooldownMinutes !== undefined) {
    data.cooldown_minutes = parsed.data.cooldownMinutes;
  }
  if (parsed.data.conditionType !== undefined) {
    data.condition_type = parsed.data.conditionType;
  }
  if (parsed.data.condition !== undefined) {
    data.condition = {
      threshold: parsed.data.condition.threshold,
      windowMinutes: parsed.data.condition.windowMinutes,
      environment: parsed.data.condition.environment ?? null,
    };
  }
  if (parsed.data.destinations !== undefined) {
    data.destinations = {
      email: parsed.data.destinations.email,
      webhookIds: [...new Set(parsed.data.destinations.webhookIds)],
    };
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

async function evaluateErrorCountRule(
  prisma: PrismaClient,
  projectId: string,
  rule: AlertRulePublic
): Promise<boolean> {
  const { threshold, windowMinutes, environment } = rule.condition;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await prisma.errorOccurrence.count({
    where: {
      created_at: { gte: since },
      error_group: {
        project_id: projectId,
        ...(environment ? { environment } : {}),
      },
    },
  });

  if (count < threshold) return false;

  const envLabel = environment ? ` in ${environment}` : "";
  const dedupeKey = alertRuleDedupeKey(rule.id, rule.cooldownMinutes);
  return fireProjectAlert(prisma, {
    projectId,
    rule: "ALERT_RULE",
    dedupeKey,
    title: rule.name,
    body: `${count.toLocaleString()} errors in the last ${windowMinutes} minutes${envLabel} (threshold ${threshold}).`,
    href: "/dashboard/errors",
    destinations: {
      email: rule.destinations.email,
      webhookIds: rule.destinations.webhookIds,
    },
  });
}

/**
 * Evaluate enabled custom alert rules for a project (ingest-triggered).
 * Unknown condition types are skipped so future values can ship without breaking evaluators.
 */
export async function maybeEvaluateAlertRules(
  prisma: PrismaClient,
  projectId: string
): Promise<void> {
  const rules = await listAlertRules(prisma, projectId);
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.conditionType === "ERROR_COUNT") {
      await evaluateErrorCountRule(prisma, projectId, rule);
      continue;
    }
    // Future condition types: skip until an evaluator is implemented.
  }
}
