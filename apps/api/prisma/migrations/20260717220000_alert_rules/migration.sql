-- AlterEnum
ALTER TYPE "AlertRuleType" ADD VALUE 'ALERT_RULE';

-- CreateTable
-- Alert rules store Condition[] (AND) + opaque destination_ids.
-- Delivery (email / Slack / Discord / …) is owned by Notifications via fireProjectAlert.
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "destination_ids" JSONB NOT NULL,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_project_id_enabled_idx" ON "AlertRule"("project_id", "enabled");

-- CreateIndex
CREATE INDEX "AlertRule_project_id_deleted_at_idx" ON "AlertRule"("project_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
