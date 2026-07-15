/**
 * CLI: `pnpm --filter api brief-worker [-- --once]`
 * Requires `DATABASE_URL` and private brief service configuration.
 */
import { resolveWorkerPollMs } from "../lib/brief-async-config.js";
import { prisma } from "../lib/db.js";
import { processNextBriefGenerationJob } from "../lib/brief-worker.js";

const ONCE = process.argv.includes("--once");
const POLL_MS = resolveWorkerPollMs(process.env);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: pnpm --filter api brief-worker [-- --once]

Options:
  --once      Process at most one job and exit
  --help, -h  Show this help

Environment:
  DATABASE_URL
  TELEMETRY_AI_BRIEF_URL
  TELEMETRY_AI_BRIEF_SECRET
  TELEMETRY_AI_BRIEF_WORKER_TOTAL_BUDGET_MS (default 60000)
  TELEMETRY_AI_BRIEF_WORKER_ATTEMPT_TIMEOUT_MS (default 60000)
  BRIEF_WORKER_POLL_MS (default 1000)
`);
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  while (true) {
    const result = await processNextBriefGenerationJob({ prisma });
    console.log(JSON.stringify({ ok: true, ...result, at: new Date().toISOString() }));
    if (ONCE) break;
    if (result.status === "idle") {
      await sleep(POLL_MS);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
