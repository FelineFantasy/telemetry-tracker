/**
 * Opt-in backfill: scrub already-stored telemetry with the same rules as ingest.
 * Prefer scoping with --project-id or --org-id. Never runs without a scope.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  isIngestPiiScrubEnabled,
  resolveIngestPiiScrubOptions,
  scrubIngestSessionUserEmail,
} from "../lib/ingest-pii-scrub.js";
import { scrubPiiRecord, scrubPiiText } from "../lib/pii-scrub.js";
import {
  parseProjectPiiScrubSettings,
  type ProjectPiiScrubSettings,
} from "../lib/project-pii-scrub-settings.js";

export type PiiScrubBackfillOptions = {
  dryRun?: boolean;
  /** Required unless orgId is set. */
  projectId?: string;
  /** All non-deleted projects in this organization. */
  orgId?: string;
  /** Max rows to examine per table for the entire run (shared across projects). */
  limit?: number;
  /** Cursor page size (default 200). */
  batchSize?: number;
  /**
   * When true, also scrub Session.user_email for projects with
   * scrubSessionUserEmail enabled (stores `[email]`).
   */
  includeSessions?: boolean;
  /**
   * When true, attempt to scrub ErrorGroup.fingerprint with scrubPiiText.
   * Skips the fingerprint update on unique conflicts (message/top_stack still scrubbed).
   * Default false — fingerprints may retain historical PII; see docs.
   */
  scrubFingerprints?: boolean;
  /**
   * When true, abort the run on the first database error.
   * Default false — log/count the error and continue.
   */
  failFast?: boolean;
  /** Optional progress logger (batch-level). */
  onProgress?: (message: string) => void;
};

export type PiiScrubBackfillResult = {
  projectsProcessed: number;
  dryRun: boolean;
  scanned: {
    events: number;
    occurrences: number;
    groups: number;
    sessions: number;
  };
  modified: {
    events: number;
    occurrences: number;
    groups: number;
    sessions: number;
    fingerprints: number;
  };
  skipped: {
    alreadyScrubbed: number;
    fingerprintConflicts: number;
  };
  failures: {
    databaseErrors: number;
  };
};

const DEFAULT_BATCH = 200;

function emptyResult(dryRun: boolean): PiiScrubBackfillResult {
  return {
    projectsProcessed: 0,
    dryRun,
    scanned: { events: 0, occurrences: 0, groups: 0, sessions: 0 },
    modified: {
      events: 0,
      occurrences: 0,
      groups: 0,
      sessions: 0,
      fingerprints: 0,
    },
    skipped: { alreadyScrubbed: 0, fingerprintConflicts: 0 },
    failures: { databaseErrors: 0 },
  };
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isUniqueConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export function parsePiiScrubBackfillArgs(argv: string[]): {
  help: boolean;
  options: PiiScrubBackfillOptions;
  error?: string;
} {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true, options: {} };
  }

  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i < 0) return undefined;
    return argv[i + 1];
  };

  const projectId = get("--project-id")?.trim();
  const orgId = get("--org-id")?.trim();
  const limitRaw = get("--limit");
  const batchRaw = get("--batch-size");

  let limit: number | undefined;
  if (limitRaw !== undefined) {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 1) {
      return { help: false, options: {}, error: "--limit must be a positive integer" };
    }
    limit = n;
  }

  let batchSize = DEFAULT_BATCH;
  if (batchRaw !== undefined) {
    const n = Number.parseInt(batchRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 2000) {
      return {
        help: false,
        options: {},
        error: "--batch-size must be between 1 and 2000",
      };
    }
    batchSize = n;
  }

  if (!projectId && !orgId) {
    return {
      help: false,
      options: {},
      error: "Provide exactly one of --project-id <uuid> or --org-id <uuid> (global backfill is not supported)",
    };
  }

  if (projectId && orgId) {
    return {
      help: false,
      options: {},
      error: "Provide exactly one of --project-id or --org-id (not both)",
    };
  }

  return {
    help: false,
    options: {
      dryRun: argv.includes("--dry-run"),
      projectId: projectId || undefined,
      orgId: orgId || undefined,
      limit,
      batchSize,
      includeSessions: argv.includes("--include-sessions"),
      scrubFingerprints: argv.includes("--scrub-fingerprints"),
      failFast: argv.includes("--fail-fast"),
    },
  };
}

/** Human-readable summary for self-hosters / cron logs. */
export function formatPiiScrubBackfillReport(result: PiiScrubBackfillResult): string {
  const mode = result.dryRun ? "dry-run (no rows written)" : "apply";
  return [
    `PII scrub backfill (${mode}) — projects: ${result.projectsProcessed}`,
    "",
    "Scanned:",
    `- Events: ${result.scanned.events}`,
    `- Occurrences: ${result.scanned.occurrences}`,
    `- Groups: ${result.scanned.groups}`,
    `- Sessions: ${result.scanned.sessions}`,
    "",
    "Modified:",
    `- Events: ${result.modified.events}`,
    `- Occurrences: ${result.modified.occurrences}`,
    `- Groups: ${result.modified.groups}`,
    `- Sessions: ${result.modified.sessions}`,
    `- Fingerprints: ${result.modified.fingerprints}`,
    "",
    "Skipped:",
    `- Already scrubbed: ${result.skipped.alreadyScrubbed}`,
    `- Fingerprint conflicts: ${result.skipped.fingerprintConflicts}`,
    "",
    "Failures:",
    `- Database errors: ${result.failures.databaseErrors}`,
    "",
    result.failures.databaseErrors > 0
      ? "Completed with database errors (partial)."
      : "Completed successfully.",
  ].join("\n");
}

export async function runPiiScrubBackfill(
  prisma: PrismaClient,
  options: PiiScrubBackfillOptions
): Promise<PiiScrubBackfillResult> {
  const dryRun = options.dryRun === true;
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const limit = options.limit;
  const includeSessions = options.includeSessions === true;
  const scrubFingerprints = options.scrubFingerprints === true;
  const failFast = options.failFast === true;
  const onProgress = options.onProgress;

  if (!isIngestPiiScrubEnabled(process.env)) {
    throw new Error(
      "TELEMETRY_INGEST_PII_SCRUB is disabled; enable scrubbing before running backfill"
    );
  }

  if (!options.projectId && !options.orgId) {
    throw new Error("projectId or orgId is required");
  }
  if (options.projectId && options.orgId) {
    throw new Error("Provide exactly one of projectId or orgId (not both)");
  }

  const projects = await prisma.project.findMany({
    where: {
      deleted_at: null,
      ...(options.projectId ? { id: options.projectId } : {}),
      ...(options.orgId
        ? { organization_id: options.orgId, organization: { deleted_at: null } }
        : {}),
    },
    select: { id: true, pii_scrub_settings: true },
  });

  if (projects.length === 0) {
    if (options.projectId) {
      throw new Error(
        `No eligible project found for --project-id ${options.projectId} (unknown or deleted)`
      );
    }
    throw new Error(
      `No eligible projects found for --org-id ${options.orgId} (unknown organization, deleted organization, or no active projects)`
    );
  }

  const result = emptyResult(dryRun);

  for (const project of projects) {
    result.projectsProcessed += 1;
    const settings = parseProjectPiiScrubSettings(project.pii_scrub_settings);
    const scrubOpts = resolveIngestPiiScrubOptions(process.env, {
      denyKeys: settings.denyKeys,
    });
    onProgress?.(
      `project ${project.id}: starting (denyKeys=${settings.denyKeys.length} scrubSessionUserEmail=${settings.scrubSessionUserEmail})`
    );

    await scrubEventsForProject(prisma, project.id, scrubOpts, {
      dryRun,
      batchSize,
      limit,
      failFast,
      onProgress,
      result,
    });
    await scrubOccurrencesForProject(prisma, project.id, scrubOpts, {
      dryRun,
      batchSize,
      limit,
      failFast,
      onProgress,
      result,
    });
    await scrubErrorGroupsForProject(prisma, project.id, {
      dryRun,
      batchSize,
      limit,
      scrubFingerprints,
      failFast,
      onProgress,
      result,
    });
    if (includeSessions) {
      await scrubSessionsForProject(prisma, project.id, settings, {
        dryRun,
        batchSize,
        limit,
        failFast,
        onProgress,
        result,
      });
    } else {
      onProgress?.(`project ${project.id}: sessions skipped (pass --include-sessions)`);
    }
  }

  return result;
}

type MutateCounters = {
  dryRun: boolean;
  batchSize: number;
  limit?: number;
  failFast: boolean;
  onProgress?: (message: string) => void;
  result: PiiScrubBackfillResult;
};

async function recordDbError(
  ctx: MutateCounters,
  scope: string,
  rowId: string,
  err: unknown
): Promise<void> {
  ctx.result.failures.databaseErrors += 1;
  ctx.onProgress?.(
    `${scope} ${rowId}: database error — ${err instanceof Error ? err.message : String(err)}`
  );
  if (ctx.failFast) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

async function scrubEventsForProject(
  prisma: PrismaClient,
  projectId: string,
  scrubOpts: ReturnType<typeof resolveIngestPiiScrubOptions>,
  ctx: MutateCounters
): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const scanned = ctx.result.scanned.events;
    if (ctx.limit !== undefined && scanned >= ctx.limit) break;
    const take = Math.min(
      ctx.batchSize,
      ctx.limit !== undefined ? ctx.limit - scanned : ctx.batchSize
    );
    const rows = await prisma.event.findMany({
      where: { project_id: projectId },
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, properties: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    ctx.result.scanned.events += rows.length;

    for (const row of rows) {
      if (row.properties == null || typeof row.properties !== "object") {
        ctx.result.skipped.alreadyScrubbed += 1;
        continue;
      }
      const scrubbed = scrubPiiRecord(
        row.properties as Record<string, unknown>,
        scrubOpts
      );
      if (jsonEqual(row.properties, scrubbed)) {
        ctx.result.skipped.alreadyScrubbed += 1;
        continue;
      }
      if (ctx.dryRun) {
        ctx.result.modified.events += 1;
        continue;
      }
      try {
        await prisma.event.update({
          where: { id: row.id },
          data: { properties: scrubbed as Prisma.InputJsonValue },
        });
        ctx.result.modified.events += 1;
      } catch (err) {
        await recordDbError(ctx, "event", row.id, err);
      }
    }
    ctx.onProgress?.(
      `project ${projectId}: events scanned=${ctx.result.scanned.events} modified=${ctx.result.modified.events}`
    );
    if (rows.length < take) break;
  }
}

async function scrubOccurrencesForProject(
  prisma: PrismaClient,
  projectId: string,
  scrubOpts: ReturnType<typeof resolveIngestPiiScrubOptions>,
  ctx: MutateCounters
): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const scanned = ctx.result.scanned.occurrences;
    if (ctx.limit !== undefined && scanned >= ctx.limit) break;
    const take = Math.min(
      ctx.batchSize,
      ctx.limit !== undefined ? ctx.limit - scanned : ctx.batchSize
    );
    const rows = await prisma.errorOccurrence.findMany({
      where: { error_group: { project_id: projectId } },
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, stack: true, context: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    ctx.result.scanned.occurrences += rows.length;

    for (const row of rows) {
      const nextStack =
        row.stack != null ? scrubPiiText(row.stack) : row.stack;
      const nextContext =
        row.context != null && typeof row.context === "object"
          ? scrubPiiRecord(row.context as Record<string, unknown>, scrubOpts)
          : row.context;
      const stackChanged = nextStack !== row.stack;
      const contextChanged = !jsonEqual(row.context, nextContext);
      if (!stackChanged && !contextChanged) {
        ctx.result.skipped.alreadyScrubbed += 1;
        continue;
      }
      if (ctx.dryRun) {
        ctx.result.modified.occurrences += 1;
        continue;
      }
      try {
        await prisma.errorOccurrence.update({
          where: { id: row.id },
          data: {
            ...(stackChanged ? { stack: nextStack } : {}),
            ...(contextChanged
              ? { context: nextContext as Prisma.InputJsonValue }
              : {}),
          },
        });
        ctx.result.modified.occurrences += 1;
      } catch (err) {
        await recordDbError(ctx, "occurrence", row.id, err);
      }
    }
    ctx.onProgress?.(
      `project ${projectId}: occurrences scanned=${ctx.result.scanned.occurrences} modified=${ctx.result.modified.occurrences}`
    );
    if (rows.length < take) break;
  }
}

async function scrubErrorGroupsForProject(
  prisma: PrismaClient,
  projectId: string,
  ctx: MutateCounters & { scrubFingerprints: boolean }
): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const scanned = ctx.result.scanned.groups;
    if (ctx.limit !== undefined && scanned >= ctx.limit) break;
    const take = Math.min(
      ctx.batchSize,
      ctx.limit !== undefined ? ctx.limit - scanned : ctx.batchSize
    );
    const rows = await prisma.errorGroup.findMany({
      where: { project_id: projectId },
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, message: true, top_stack: true, fingerprint: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    ctx.result.scanned.groups += rows.length;

    for (const row of rows) {
      const nextMessage = scrubPiiText(row.message);
      const nextTop =
        row.top_stack != null ? scrubPiiText(row.top_stack) : row.top_stack;
      const messageChanged = nextMessage !== row.message;
      const topChanged = nextTop !== row.top_stack;

      let nextFingerprint = row.fingerprint;
      let fingerprintChanged = false;
      if (ctx.scrubFingerprints) {
        const scrubbedFp = scrubPiiText(row.fingerprint);
        if (scrubbedFp !== row.fingerprint) {
          nextFingerprint = scrubbedFp;
          fingerprintChanged = true;
        }
      }

      if (!messageChanged && !topChanged && !fingerprintChanged) {
        ctx.result.skipped.alreadyScrubbed += 1;
        continue;
      }

      if (ctx.dryRun) {
        ctx.result.modified.groups += 1;
        if (fingerprintChanged) ctx.result.modified.fingerprints += 1;
        continue;
      }

      try {
        await prisma.errorGroup.update({
          where: { id: row.id },
          data: {
            ...(messageChanged ? { message: nextMessage } : {}),
            ...(topChanged ? { top_stack: nextTop } : {}),
            ...(fingerprintChanged ? { fingerprint: nextFingerprint } : {}),
          },
        });
        ctx.result.modified.groups += 1;
        if (fingerprintChanged) ctx.result.modified.fingerprints += 1;
      } catch (err) {
        if (fingerprintChanged && isUniqueConflict(err)) {
          ctx.result.skipped.fingerprintConflicts += 1;
          // Keep group ↔ occurrence associations; scrub display fields only.
          if (messageChanged || topChanged) {
            try {
              await prisma.errorGroup.update({
                where: { id: row.id },
                data: {
                  ...(messageChanged ? { message: nextMessage } : {}),
                  ...(topChanged ? { top_stack: nextTop } : {}),
                },
              });
              ctx.result.modified.groups += 1;
            } catch (inner) {
              await recordDbError(ctx, "errorGroup", row.id, inner);
            }
          } else {
            ctx.result.skipped.alreadyScrubbed += 1;
          }
          continue;
        }
        await recordDbError(ctx, "errorGroup", row.id, err);
      }
    }
    ctx.onProgress?.(
      `project ${projectId}: groups scanned=${ctx.result.scanned.groups} modified=${ctx.result.modified.groups} fingerprintConflicts=${ctx.result.skipped.fingerprintConflicts}`
    );
    if (rows.length < take) break;
  }
}

async function scrubSessionsForProject(
  prisma: PrismaClient,
  projectId: string,
  settings: ProjectPiiScrubSettings,
  ctx: MutateCounters
): Promise<void> {
  if (!settings.scrubSessionUserEmail) {
    ctx.onProgress?.(
      `project ${projectId}: sessions skipped (scrubSessionUserEmail is false)`
    );
    return;
  }

  let cursor: string | undefined;
  for (;;) {
    const scanned = ctx.result.scanned.sessions;
    if (ctx.limit !== undefined && scanned >= ctx.limit) break;
    const take = Math.min(
      ctx.batchSize,
      ctx.limit !== undefined ? ctx.limit - scanned : ctx.batchSize
    );
    const rows = await prisma.session.findMany({
      where: {
        project_id: projectId,
        user_email: { not: null },
      },
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, user_email: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    ctx.result.scanned.sessions += rows.length;

    for (const row of rows) {
      const next = scrubIngestSessionUserEmail(
        row.user_email,
        true,
        process.env
      );
      if (next === row.user_email || next === undefined) {
        ctx.result.skipped.alreadyScrubbed += 1;
        continue;
      }
      if (ctx.dryRun) {
        ctx.result.modified.sessions += 1;
        continue;
      }
      try {
        await prisma.session.update({
          where: { id: row.id },
          data: { user_email: next },
        });
        ctx.result.modified.sessions += 1;
      } catch (err) {
        await recordDbError(ctx, "session", row.id, err);
      }
    }
    ctx.onProgress?.(
      `project ${projectId}: sessions scanned=${ctx.result.scanned.sessions} modified=${ctx.result.modified.sessions}`
    );
    if (rows.length < take) break;
  }
}
