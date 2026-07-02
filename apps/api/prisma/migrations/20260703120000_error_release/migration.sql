-- AlterTable
ALTER TABLE "ErrorGroup" ADD COLUMN "release" TEXT;

-- AlterTable
ALTER TABLE "ErrorOccurrence" ADD COLUMN "release" TEXT;

-- CreateIndex
CREATE INDEX "ErrorGroup_project_id_release_idx" ON "ErrorGroup"("project_id", "release");
