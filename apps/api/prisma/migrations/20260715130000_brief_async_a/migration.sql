-- CreateEnum
CREATE TYPE "BriefGenerationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "BriefCompleted" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "presentation_hash" TEXT NOT NULL,
    "response_schema_version" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "snapshot_hash" TEXT NOT NULL,
    "brief_json" JSONB NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefCompleted_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefGenerationJob" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "presentation_hash" TEXT NOT NULL,
    "response_schema_version" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "status" "BriefGenerationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "BriefGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BriefCompleted_organization_id_content_hash_presentation_hash_response_schema_version_key" ON "BriefCompleted"("organization_id", "content_hash", "presentation_hash", "response_schema_version");

-- CreateIndex
CREATE INDEX "BriefCompleted_organization_id_completed_at_idx" ON "BriefCompleted"("organization_id", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "BriefCompleted_expires_at_idx" ON "BriefCompleted"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "BriefGenerationJob_organization_id_content_hash_presentation_hash_response_schema_version_key" ON "BriefGenerationJob"("organization_id", "content_hash", "presentation_hash", "response_schema_version");

-- CreateIndex
CREATE INDEX "BriefGenerationJob_status_lease_expires_at_created_at_idx" ON "BriefGenerationJob"("status", "lease_expires_at", "created_at");

-- CreateIndex
CREATE INDEX "BriefGenerationJob_organization_id_created_at_idx" ON "BriefGenerationJob"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "BriefCompleted" ADD CONSTRAINT "BriefCompleted_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefGenerationJob" ADD CONSTRAINT "BriefGenerationJob_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
