/**
 * CLI: `pnpm --filter api exec tsx src/jobs/run-retention.ts`
 * Requires `DATABASE_URL`. Intended for cron / scheduled jobs.
 */
import { prisma } from "../lib/db.js";
import { runRetentionSweep } from "./retention.js";

async function main(): Promise<void> {
  const result = await runRetentionSweep(prisma);
  console.log(
    JSON.stringify({ ok: true, ...result, at: new Date().toISOString() })
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
