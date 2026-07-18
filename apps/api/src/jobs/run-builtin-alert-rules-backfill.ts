/**
 * One-shot backfill: create SYSTEM AlertRule rows from Project.alert_settings (#535).
 *
 * Safe to re-run (idempotent upsert by migration_key). Lazy ensure on alert-settings
 * read/write also covers projects; this job is for explicit rollout / verification.
 *
 * Usage:
 *   pnpm --filter api builtin-alert-rules-backfill
 *   pnpm --filter api builtin-alert-rules-backfill -- --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { backfillBuiltinAlertRules } from "../lib/builtin-alert-rules.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  try {
    const result = await backfillBuiltinAlertRules(prisma, {
      dryRun,
      onProgress: (message) => console.log(message),
    });
    console.log(JSON.stringify({ dryRun, ...result }, null, 2));
    if (result.failures > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
