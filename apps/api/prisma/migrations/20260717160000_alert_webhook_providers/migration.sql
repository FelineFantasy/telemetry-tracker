-- CreateEnum
CREATE TYPE "AlertWebhookProvider" AS ENUM ('GENERIC', 'SLACK', 'DISCORD', 'MICROSOFT_TEAMS', 'TELEGRAM');

-- AlterTable
ALTER TABLE "ProjectWebhook" ADD COLUMN "provider" "AlertWebhookProvider" NOT NULL DEFAULT 'GENERIC';
ALTER TABLE "ProjectWebhook" ADD COLUMN "config" JSONB;

-- CreateIndex
CREATE INDEX "ProjectWebhook_project_id_provider_enabled_idx" ON "ProjectWebhook"("project_id", "provider", "enabled");
