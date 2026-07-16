-- AlterTable
ALTER TABLE "ErrorGroup" ADD COLUMN "platform" TEXT;

-- AlterTable
ALTER TABLE "ErrorOccurrence" ADD COLUMN "platform" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "environment" TEXT;
ALTER TABLE "Session" ADD COLUMN "release" TEXT;

-- CreateIndex
CREATE INDEX "ErrorGroup_project_id_platform_idx" ON "ErrorGroup"("project_id", "platform");

-- CreateIndex
CREATE INDEX "ErrorOccurrence_error_group_id_platform_idx" ON "ErrorOccurrence"("error_group_id", "platform");

-- CreateIndex
CREATE INDEX "ErrorOccurrence_error_group_id_release_idx" ON "ErrorOccurrence"("error_group_id", "release");

-- CreateIndex
CREATE INDEX "Session_project_id_environment_idx" ON "Session"("project_id", "environment");

-- CreateIndex
CREATE INDEX "Session_project_id_release_idx" ON "Session"("project_id", "release");
