import type { Prisma } from "@prisma/client";

/** Whether every targeted subscriber received the release email. */
export function isReleaseEmailBroadcastComplete(deliveredCount: number, subscriberCount: number): boolean {
  if (subscriberCount === 0) return true;
  return deliveredCount === subscriberCount;
}

export function pendingReleaseEmailRecipients<T extends { id: string }>(
  subscribers: T[],
  alreadySentIds: ReadonlySet<string>
): T[] {
  return subscribers.filter((subscriber) => !alreadySentIds.has(subscriber.id));
}

export async function loadReleaseEmailSentSubscriberIds(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
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

export async function recordReleaseEmailDelivery(
  db: Prisma.DefaultPrismaClient,
  input: {
    subscriberId: string;
    releaseVersion: string;
    unsubscribeTokenHash: string;
  }
): Promise<void> {
  await db.$transaction([
    db.marketingSubscriber.update({
      where: { id: input.subscriberId },
      data: { unsubscribe_token: input.unsubscribeTokenHash },
    }),
    db.marketingReleaseEmailSend.create({
      data: {
        subscriber_id: input.subscriberId,
        release_version: input.releaseVersion,
      },
    }),
  ]);
}
