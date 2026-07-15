-- AlterTable
ALTER TABLE "BriefGenerationJob" ADD COLUMN "request_until" TIMESTAMP(3);

-- Backfill existing rows with created_at as a safe fallback for dev databases.
UPDATE "BriefGenerationJob" SET "request_until" = "created_at" WHERE "request_until" IS NULL;

ALTER TABLE "BriefGenerationJob" ALTER COLUMN "request_until" SET NOT NULL;
