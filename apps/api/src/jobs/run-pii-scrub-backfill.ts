/**
 * CLI: opt-in PII scrub backfill for already-stored telemetry.
 *
 *   pnpm --filter api pii-scrub-backfill -- --project-id <uuid> --dry-run
 *
 * Requires DATABASE_URL. Prefer --dry-run first. Scope with --project-id or --org-id.
 */
import { prisma } from "../lib/db.js";
import {
  formatPiiScrubBackfillReport,
  parsePiiScrubBackfillArgs,
  runPiiScrubBackfill,
} from "./pii-scrub-backfill.js";

const parsed = parsePiiScrubBackfillArgs(process.argv.slice(2));

if (parsed.help) {
  console.log(`Usage: pnpm --filter api pii-scrub-backfill -- --project-id <uuid> [options]

Opt-in backfill that rewrites stored telemetry using the same scrubber as ingest
(project deny-keys included). Completely optional — ingest continues without it.
Global / unscoped runs are not supported.

Required (exactly one):
  --project-id <uuid>   Scrub one project
  --org-id <uuid>       Scrub all non-deleted projects in an organization

Options:
  --dry-run             Calculate scanned/modified/skipped without writing
  --limit <n>           Cap rows examined per table for the entire run (shared across projects)
  --batch-size <n>      Cursor page size (default 200, max 2000)
  --include-sessions    Also scrub Session.user_email when scrubSessionUserEmail is enabled
  --scrub-fingerprints  Also scrub ErrorGroup.fingerprint (skips on unique conflicts)
  --fail-fast           Abort on first database error (default: continue)
  --help, -h            Show this help

Notes:
  - Prefer --dry-run first to estimate impact.
  - Session emails require BOTH --include-sessions AND project scrubSessionUserEmail=true.
  - Fingerprints are unchanged unless --scrub-fingerprints is set (grouping identity risk).
  - Re-runs are idempotent: already-scrubbed placeholders are skipped.
  - TELEMETRY_INGEST_PII_SCRUB must not be disabled.
  - Interrupt with Ctrl+C; already-written batches stay committed (per-row updates).

Examples:
  pnpm --filter api pii-scrub-backfill -- --project-id <uuid> --dry-run --include-sessions
  pnpm --filter api pii-scrub-backfill -- --project-id <uuid> --scrub-fingerprints

Production (after build): node dist/jobs/run-pii-scrub-backfill.js --project-id …
`);
  process.exit(0);
}

if (parsed.error) {
  console.error(parsed.error);
  process.exit(1);
}

async function main(): Promise<void> {
  const result = await runPiiScrubBackfill(prisma, {
    ...parsed.options,
    onProgress: (message) => {
      console.error(`[pii-scrub-backfill] ${message}`);
    },
  });

  console.log(formatPiiScrubBackfillReport(result));
  console.log("");
  console.log(
    JSON.stringify({
      ok: result.failures.databaseErrors === 0,
      ...result,
      at: new Date().toISOString(),
    })
  );

  await prisma.$disconnect();
  if (result.failures.databaseErrors > 0) {
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
