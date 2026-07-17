-- CreateEnum
CREATE TYPE "AlertConditionType" AS ENUM ('ERROR_COUNT');

-- AlterEnum
ALTER TYPE "AlertRuleType" ADD VALUE 'ALERT_RULE';

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "condition_type" "AlertConditionType" NOT NULL,
    "condition" JSONB NOT NULL,
    "destinations" JSONB NOT NULL,
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
