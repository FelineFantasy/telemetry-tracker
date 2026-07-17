/**
 * CLI: `pnpm --filter api alert-webhook-worker [-- --once]`
 * Requires `DATABASE_URL`. Claims PENDING/FAILED AlertWebhookDelivery rows and POSTs.
 */
import {
  resolveAlertWebhookWorkerPollMs,
} from "../lib/alert-webhook-dispatch.js";
import { prisma } from "../lib/db.js";
import { processNextAlertWebhookDelivery } from "../lib/alert-webhook-worker.js";

const ONCE = process.argv.includes("--once");
const POLL_MS = resolveAlertWebhookWorkerPollMs(process.env);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: pnpm --filter api alert-webhook-worker [-- --once]

Options:
  --once      Process at most one delivery and exit
  --help, -h  Show this help

Environment:
  DATABASE_URL
  ALERT_WEBHOOK_WORKER_POLL_MS (default 1000)
  ALERT_WEBHOOK_WORKER_LEASE_MS (default 30000)
`);
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  while (true) {
    const result = await processNextAlertWebhookDelivery({ prisma });
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
