-- AlterTable
ALTER TABLE "ErrorOccurrence" ADD COLUMN "environment" TEXT;

-- CreateIndex
CREATE INDEX "ErrorOccurrence_error_group_id_environment_idx" ON "ErrorOccurrence"("error_group_id", "environment");
