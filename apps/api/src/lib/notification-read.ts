import type { PrismaClient } from "@prisma/client";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";

export async function loadReadNotificationIds(
  prisma: PrismaClient,
  userId: string
): Promise<Set<string>> {
  const rows = await prisma.notificationRead.findMany({
    where: { user_id: userId },
    select: { notification_id: true },
  });
  return new Set(rows.map((r) => r.notification_id));
}

export type DashboardNotificationWithRead = DashboardNotificationItem & {
  unread: boolean;
};

export async function attachNotificationReadState(
  prisma: PrismaClient,
  userId: string,
  items: DashboardNotificationItem[]
): Promise<DashboardNotificationWithRead[]> {
  if (items.length === 0) return [];
  const readIds = await loadReadNotificationIds(prisma, userId);
  return items.map((item) => ({
    ...item,
    unread: !readIds.has(item.id),
  }));
}

export async function markNotificationsRead(
  prisma: PrismaClient,
  userId: string,
  ids: string[]
): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.$transaction(
    unique.map((notification_id) =>
      prisma.notificationRead.upsert({
        where: {
          user_id_notification_id: { user_id: userId, notification_id },
        },
        create: { user_id: userId, notification_id },
        update: { read_at: new Date() },
      })
    )
  );
}
