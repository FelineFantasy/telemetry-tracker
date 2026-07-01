-- Notification read state and email dedupe log.
CREATE TABLE "NotificationRead" (
  "user_id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("user_id", "notification_id"),
  CONSTRAINT "NotificationRead_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NotificationRead_user_id_idx" ON "NotificationRead"("user_id");

CREATE TABLE "NotificationEmailLog" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "notification_key" TEXT NOT NULL,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEmailLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationEmailLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationEmailLog_user_id_notification_key_key" ON "NotificationEmailLog"("user_id", "notification_key");
CREATE INDEX "NotificationEmailLog_user_id_sent_at_idx" ON "NotificationEmailLog"("user_id", "sent_at");
