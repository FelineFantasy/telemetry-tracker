-- CreateEnum
CREATE TYPE "AlertWebhookDeliveryStatus" AS ENUM ('SUCCESS', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "ProjectWebhook" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "signing_secret" TEXT,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ProjectWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "alert_event_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "AlertWebhookDeliveryStatus" NOT NULL,
    "http_status" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectWebhook_project_id_enabled_idx" ON "ProjectWebhook"("project_id", "enabled");

-- CreateIndex
CREATE INDEX "ProjectWebhook_project_id_deleted_at_idx" ON "ProjectWebhook"("project_id", "deleted_at");

-- CreateIndex
CREATE INDEX "AlertWebhookDelivery_webhook_id_created_at_idx" ON "AlertWebhookDelivery"("webhook_id", "created_at");

-- CreateIndex
CREATE INDEX "AlertWebhookDelivery_project_id_created_at_idx" ON "AlertWebhookDelivery"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "AlertWebhookDelivery_dedupe_key_idx" ON "AlertWebhookDelivery"("dedupe_key");

-- AddForeignKey
ALTER TABLE "ProjectWebhook" ADD CONSTRAINT "ProjectWebhook_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertWebhookDelivery" ADD CONSTRAINT "AlertWebhookDelivery_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "ProjectWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertWebhookDelivery" ADD CONSTRAINT "AlertWebhookDelivery_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertWebhookDelivery" ADD CONSTRAINT "AlertWebhookDelivery_alert_event_id_fkey" FOREIGN KEY ("alert_event_id") REFERENCES "AlertEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
