import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";

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

/** Record a successful delivery after Resend accepts the message. Idempotent on duplicate rows. */
export async function recordReleaseEmailSend(
  db: PrismaTypes.DefaultPrismaClient,
  input: {
    subscriberId: string;
    releaseVersion: string;
  }
): Promise<void> {
  try {
    await db.marketingReleaseEmailSend.create({
      data: {
        subscriber_id: input.subscriberId,
        release_version: input.releaseVersion,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return;
    }
    throw err;
  }
}
