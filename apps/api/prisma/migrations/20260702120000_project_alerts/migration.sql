-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('ERROR_SPIKE', 'QUOTA_NEAR', 'QUOTA_EXCEEDED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "alert_settings" JSONB;

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "rule" "AlertRuleType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "fired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_project_id_dedupe_key_key" ON "AlertEvent"("project_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "AlertEvent_project_id_fired_at_idx" ON "AlertEvent"("project_id", "fired_at");

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
