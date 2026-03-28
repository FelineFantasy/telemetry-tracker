-- Soft-delete for orgs/projects/keys; optional API key expiry.
ALTER TABLE "Organization" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "Organization_deleted_at_idx" ON "Organization"("deleted_at");

ALTER TABLE "Project" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "Project_deleted_at_idx" ON "Project"("deleted_at");

ALTER TABLE "ApiKey" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "ApiKey" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "ApiKey_deleted_at_idx" ON "ApiKey"("deleted_at");
