/**
 * Workspace brief contracts (public ↔ private boundary).
 *
 * Schema versions: see brief-constants.ts. No user identity in BriefSnapshotRequest.
 */

import { z } from "zod";
import {
  BRIEF_MAX_CANDIDATES_PER_LIST,
  BRIEF_RESPONSE_SCHEMA_VERSION,
  BRIEF_SCHEMA_VERSION,
} from "./brief-constants.js";

const isoDateTimeSchema = z.string().datetime();

const uuidSchema = z.string().uuid();

const snapshotHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "snapshotHash must be a 64-character hex SHA-256 digest");

const countPairSchema = z
  .object({
    count: z.number().int().nonnegative(),
    previous: z.number().int().nonnegative(),
  })
  .strict();

const metricPairSchema = z
  .object({
    value: z.number().nonnegative(),
    previous: z.number().nonnegative(),
  })
  .strict();

const deviceBrowserSliceSchema = z
  .object({
    browser: z.string().max(64),
    count: z.number().int().nonnegative(),
  })
  .strict();

const deviceOsSliceSchema = z
  .object({
    os: z.string().max(64),
    count: z.number().int().nonnegative(),
  })
  .strict();

const errorGroupCandidateSchema = z
  .object({
    id: uuidSchema,
    message: z.string().max(2000),
    app: z.string().max(64),
    environment: z.string().max(64).nullable().optional(),
    release: z.string().max(128).nullable().optional(),
    firstSeen: isoDateTimeSchema,
    lastSeen: isoDateTimeSchema,
    occurrences: countPairSchema,
    affectedUsers: countPairSchema,
    affectedUsersPct: metricPairSchema.optional(),
    topBrowsers: z.array(deviceBrowserSliceSchema).max(5).optional(),
    topOs: z.array(deviceOsSliceSchema).max(5).optional(),
  })
  .strict();

const projectWindowSchema = z
  .object({
    since: isoDateTimeSchema,
    until: isoDateTimeSchema,
    previousSince: isoDateTimeSchema,
    previousUntil: isoDateTimeSchema,
    durationMs: z.number().int().positive(),
  })
  .strict();

const factualErrorGroupsSchema = z
  .object({
    firstSeenInWindow: z.array(errorGroupCandidateSchema).max(BRIEF_MAX_CANDIDATES_PER_LIST),
    byOccurrenceCount: z.array(errorGroupCandidateSchema).max(BRIEF_MAX_CANDIDATES_PER_LIST),
    byAbsoluteDelta: z.array(errorGroupCandidateSchema).max(BRIEF_MAX_CANDIDATES_PER_LIST),
  })
  .strict();

const releaseRowSchema = z
  .object({
    release: z.string().max(128),
    errorOccurrences: z.number().int().nonnegative(),
    eventRows: z.number().int().nonnegative(),
  })
  .strict();

const environmentRowSchema = z
  .object({
    environment: z.string().max(64),
    count: z.number().int().nonnegative(),
  })
  .strict();

const environmentDistributionSchema = z
  .object({
    byEventRows: z.array(environmentRowSchema).max(5),
  })
  .strict();

const projectKpisSchema = z
  .object({
    errors: countPairSchema,
    events: countPairSchema,
    sessions: countPairSchema,
    activeUsers: countPairSchema,
    errorRatePct: metricPairSchema,
  })
  .strict();

const sessionsSummarySchema = z
  .object({
    avgDurationSec: metricPairSchema.optional(),
    crashFreeRatePct: metricPairSchema.optional(),
    bounceRatePct: metricPairSchema.optional(),
    activeUsers: metricPairSchema.optional(),
  })
  .strict();

export const projectSnapshotSchema = z
  .object({
    projectId: uuidSchema,
    projectName: z.string().max(120),
    projectSlug: z.string().max(64),
    window: projectWindowSchema,
    kpis: projectKpisSchema,
    releases: z
      .object({
        byErrorOccurrences: z.array(releaseRowSchema).max(BRIEF_MAX_CANDIDATES_PER_LIST),
      })
      .strict()
      .optional(),
    errorGroups: factualErrorGroupsSchema,
    sessionsSummary: sessionsSummarySchema.optional(),
    environments: environmentDistributionSchema.optional(),
  })
  .strict();

export const briefSnapshotRequestSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
    requestId: uuidSchema,
    generatedAt: isoDateTimeSchema,
    organizationId: uuidSchema,
    viewer: z
      .object({
        timezone: z.string().max(64).nullable().optional(),
      })
      .strict(),
    projects: z.array(projectSnapshotSchema).min(1).max(50),
  })
  .strict();

export type BriefSnapshotRequest = z.infer<typeof briefSnapshotRequestSchema>;
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;

export const briefActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("open_overview"),
      projectId: uuidSchema,
      app: z.string().max(64).optional(),
      environment: z.string().max(64).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("open_errors"),
      projectId: uuidSchema,
      app: z.string().max(64).optional(),
      environment: z.string().max(64).optional(),
      release: z.string().max(128).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("open_sessions"),
      projectId: uuidSchema,
      app: z.string().max(64).optional(),
      environment: z.string().max(64).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("open_error_group"),
      projectId: uuidSchema,
      errorGroupId: uuidSchema,
      app: z.string().max(64).optional(),
      environment: z.string().max(64).optional(),
    })
    .strict(),
]);

export type BriefAction = z.infer<typeof briefActionSchema>;

const briefToneSchema = z.enum(["neutral", "good", "warning", "critical"]);

const evidenceRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("error_group"), id: uuidSchema }).strict(),
  z.object({ kind: z.literal("metric"), key: z.string().max(64) }).strict(),
  z.object({ kind: z.literal("release"), value: z.string().max(128) }).strict(),
]);

const projectBriefBulletSchema = z
  .object({
    tone: briefToneSchema,
    text: z.string().max(500),
    evidenceRefs: z.array(evidenceRefSchema).max(10).optional(),
  })
  .strict();

const projectBriefBadgeSchema = z
  .object({
    label: z.string().max(64),
    tone: z.enum(["muted", "good", "warning", "critical"]),
  })
  .strict();

export const projectBriefSchema = z
  .object({
    projectId: uuidSchema,
    generatedThrough: isoDateTimeSchema,
    significance: z.enum(["none", "low", "medium", "high"]),
    collapsedLabel: z.string().max(200),
    headline: z.string().max(300).optional(),
    bullets: z.array(projectBriefBulletSchema).max(10).optional(),
    suggestedNextStep: briefActionSchema.optional(),
    badges: z.array(projectBriefBadgeSchema).max(5).optional(),
  })
  .strict();

export const workspaceBriefResponseSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_RESPONSE_SCHEMA_VERSION),
    requestId: uuidSchema,
    generatedAt: isoDateTimeSchema,
    workspace: z
      .object({
        title: z.string().max(120),
        subtitle: z.string().max(200).optional(),
      })
      .strict(),
    projects: z.array(projectBriefSchema).min(1).max(50),
  })
  .strict();

export type WorkspaceBriefResponse = z.infer<typeof workspaceBriefResponseSchema>;
export type ProjectBrief = z.infer<typeof projectBriefSchema>;

export const acknowledgeBriefRequestSchema = z
  .object({
    requestId: uuidSchema,
    snapshotHash: snapshotHashSchema,
    projects: z
      .array(
        z
          .object({
            projectId: uuidSchema,
            acknowledgedThrough: isoDateTimeSchema,
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict();

export type AcknowledgeBriefRequest = z.infer<typeof acknowledgeBriefRequestSchema>;

export const acknowledgeBriefResponseSchema = z.object({
  ok: z.literal(true),
  updated: z.array(
    z.object({
      projectId: uuidSchema,
      acknowledgedThrough: isoDateTimeSchema,
    })
  ),
});

export type AcknowledgeBriefResponse = z.infer<typeof acknowledgeBriefResponseSchema>;

export function parseBriefSnapshotRequest(
  raw: unknown
): { ok: true; data: BriefSnapshotRequest } | { ok: false; error: string } {
  const parsed = briefSnapshotRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid brief snapshot request" };
  }
  return { ok: true, data: parsed.data };
}

export function parseWorkspaceBriefResponse(
  raw: unknown
): { ok: true; data: WorkspaceBriefResponse } | { ok: false; error: string } {
  const parsed = workspaceBriefResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid workspace brief response" };
  }
  return { ok: true, data: parsed.data };
}

export function parseAcknowledgeBriefRequest(
  raw: unknown
): { ok: true; data: AcknowledgeBriefRequest } | { ok: false; error: string } {
  const parsed = acknowledgeBriefRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid acknowledge brief request" };
  }
  return { ok: true, data: parsed.data };
}

const briefBuildMetaSchema = z
  .object({
    truncated: z.boolean(),
    truncationSteps: z.array(z.string()),
    droppedProjectIds: z.array(uuidSchema),
    byteLength: z.number().int().nonnegative(),
    aiLatencyMs: z.number().int().nonnegative().optional(),
    source: z.enum(["ai", "cache"]).optional(),
  })
  .strict();

export const workspaceBriefRequestBodySchema = z
  .object({
    timezone: z.string().max(64).nullable().optional(),
  })
  .strict();

export const workspaceBriefOkResponseSchema = z
  .object({
    status: z.literal("ok"),
    requestId: uuidSchema,
    snapshotHash: snapshotHashSchema,
    contentHash: snapshotHashSchema,
    brief: workspaceBriefResponseSchema,
    meta: briefBuildMetaSchema.extend({ source: z.enum(["ai", "cache"]) }),
  })
  .strict();

export const workspaceBriefUnavailableResponseSchema = z
  .object({
    status: z.literal("unavailable"),
    requestId: uuidSchema,
    snapshotHash: snapshotHashSchema,
    contentHash: snapshotHashSchema,
    reason: z.enum([
      "ai_timeout",
      "ai_unreachable",
      "ai_http_5xx",
      "ai_misconfigured",
      "ai_idempotency_conflict",
      "ai_invalid_request",
      "ai_invalid_response",
      "circuit_open",
    ]),
    fallback: z
      .object({
        schemaVersion: z.literal("2026-07-brief-fallback-v1"),
        requestId: uuidSchema,
        generatedAt: isoDateTimeSchema,
        projects: z.array(
          z
            .object({
              projectId: uuidSchema,
              generatedThrough: isoDateTimeSchema,
              facts: z.array(z.record(z.unknown())),
            })
            .strict()
        ),
      })
      .strict(),
    meta: briefBuildMetaSchema,
  })
  .strict();
