-- CreateEnum
CREATE TYPE "AlertRuleSource" AS ENUM ('CUSTOM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertRuleSystemKind" AS ENUM ('ERROR_SPIKE', 'QUOTA_WARNING', 'QUOTA_EXCEEDED');

-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN "source" "AlertRuleSource" NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "AlertRule" ADD COLUMN "system_kind" "AlertRuleSystemKind";
ALTER TABLE "AlertRule" ADD COLUMN "migration_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_project_id_migration_key_key" ON "AlertRule"("project_id", "migration_key");

-- CreateIndex
CREATE INDEX "AlertRule_project_id_source_idx" ON "AlertRule"("project_id", "source");
