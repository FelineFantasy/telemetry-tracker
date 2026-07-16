-- request_until is included in 20260715130000_brief_async_a for fresh databases.
-- Keep this migration idempotent for databases that applied an earlier async_a revision.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'BriefGenerationJob'
      AND column_name = 'request_until'
  ) THEN
    ALTER TABLE "BriefGenerationJob" ADD COLUMN "request_until" TIMESTAMP(3);
    UPDATE "BriefGenerationJob"
    SET "request_until" = "created_at"
    WHERE "request_until" IS NULL;
    ALTER TABLE "BriefGenerationJob" ALTER COLUMN "request_until" SET NOT NULL;
  END IF;
END $$;
