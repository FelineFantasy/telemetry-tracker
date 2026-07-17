import type { Prisma as PrismaTypes } from "@prisma/client";

const RECORD_SEND_MAX_ATTEMPTS = 3;
const RECORD_SEND_RETRY_MS = 250;

/** Whether every targeted subscriber received the release email. */
export function isReleaseEmailBroadcastComplete(deliveredCount: number, subscriberCount: number): boolean {
  if (subscriberCount === 0) return false;
  return deliveredCount === subscriberCount;
}

export function pendingReleaseEmailRecipients<T extends { id: string }>(
  subscribers: T[],
  alreadySentIds: ReadonlySet<string>
): T[] {
  return subscribers.filter((subscriber) => !alreadySentIds.has(subscriber.id));
}

/**
 * Live/dry-run copy when deliverable recipients are empty after reserved-domain filtering.
 * Distinguishes “no active rows” from “all active rows were undeliverable.”
 */
export function emptyReleaseEmailAudienceMessage(
  activeCount: number,
  options: { dryRun?: boolean } = {}
): string {
  const dryRun = options.dryRun === true;
  if (activeCount > 0) {
    return dryRun
      ? `--dry-run: would send to 0 subscriber(s) (${activeCount} active row(s) skipped as reserved/invalid).`
      : `No deliverable marketing subscribers (${activeCount} active row(s) skipped as reserved/invalid). Clean up reserved addresses or add deliverable subscribers; the workflow can be retried safely.`;
  }
  return dryRun
    ? "--dry-run: would send to 0 subscriber(s)."
    : "No active marketing subscribers. Re-run after subscribers exist; the workflow can be retried safely.";
}

export async function loadReleaseEmailSentSubscriberIds(
  db: PrismaTypes.TransactionClient | PrismaTypes.DefaultPrismaClient,
  releaseVersion: string,
  subscriberIds: string[]
): Promise<Set<string>> {
  if (subscriberIds.length === 0) return new Set();

  const rows = await db.marketingReleaseEmailSend.findMany({
    where: {
      release_version: releaseVersion,
      subscriber_id: { in: subscriberIds },
    },
    select: { subscriber_id: true },
  });

  return new Set(rows.map((row) => row.subscriber_id));
}

/** Persist the unsubscribe token hash before sending so the email link matches the database. */
export async function stageReleaseEmailUnsubscribeToken(
  db: PrismaTypes.DefaultPrismaClient,
  input: {
    subscriberId: string;
    unsubscribeTokenHash: string;
  }
): Promise<void> {
  await db.marketingSubscriber.update({
    where: { id: input.subscriberId },
    data: { unsubscribe_token: input.unsubscribeTokenHash },
  });
}

export async function revertReleaseEmailUnsubscribeToken(
  db: PrismaTypes.DefaultPrismaClient,
  input: {
    subscriberId: string;
    previousUnsubscribeTokenHash: string;
  }
): Promise<void> {
  await db.marketingSubscriber.update({
    where: { id: input.subscriberId },
    data: { unsubscribe_token: input.previousUnsubscribeTokenHash },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Record a successful delivery after Resend accepts the message. Idempotent via upsert. */
export async function recordReleaseEmailSend(
  db: PrismaTypes.DefaultPrismaClient,
  input: {
    subscriberId: string;
    releaseVersion: string;
  }
): Promise<void> {
  await db.marketingReleaseEmailSend.upsert({
    where: {
      subscriber_id_release_version: {
        subscriber_id: input.subscriberId,
        release_version: input.releaseVersion,
      },
    },
    create: {
      subscriber_id: input.subscriberId,
      release_version: input.releaseVersion,
    },
    update: {},
  });
}

/** Retry transient ledger write failures so accepted emails are not retried as pending. */
export async function recordReleaseEmailSendReliable(
  db: PrismaTypes.DefaultPrismaClient,
  input: {
    subscriberId: string;
    releaseVersion: string;
  }
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RECORD_SEND_MAX_ATTEMPTS; attempt += 1) {
    try {
      await recordReleaseEmailSend(db, input);
      return;
    } catch (err) {
      lastError = err;
      if (attempt === RECORD_SEND_MAX_ATTEMPTS) break;
      await sleep(RECORD_SEND_RETRY_MS * attempt);
    }
  }

  const recorded = await loadReleaseEmailSentSubscriberIds(db, input.releaseVersion, [input.subscriberId]);
  if (recorded.has(input.subscriberId)) {
    return;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to record release email delivery after Resend accepted the message.");
}
