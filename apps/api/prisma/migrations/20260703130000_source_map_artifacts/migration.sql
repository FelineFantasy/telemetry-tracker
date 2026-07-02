-- CreateTable
CREATE TABLE "SourceMapArtifact" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "release" TEXT NOT NULL,
    "bundle_url" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "storage_key" TEXT,
    "sha256" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceMapArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceMapArtifact_project_id_release_idx" ON "SourceMapArtifact"("project_id", "release");

-- CreateIndex
CREATE INDEX "SourceMapArtifact_project_id_uploaded_at_idx" ON "SourceMapArtifact"("project_id", "uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "SourceMapArtifact_project_id_app_release_bundle_url_key" ON "SourceMapArtifact"("project_id", "app", "release", "bundle_url");

-- AddForeignKey
ALTER TABLE "SourceMapArtifact" ADD CONSTRAINT "SourceMapArtifact_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
