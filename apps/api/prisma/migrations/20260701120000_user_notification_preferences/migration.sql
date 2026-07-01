-- Per-user notification channel, routing, and quiet-hours preferences (JSON).
ALTER TABLE "User" ADD COLUMN "notification_preferences" JSONB;
