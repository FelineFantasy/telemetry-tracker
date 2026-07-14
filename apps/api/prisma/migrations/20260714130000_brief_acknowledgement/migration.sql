-- Per-user workspace brief acknowledgement watermark (one row per user + project).
CREATE TABLE "BriefAcknowledgement" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "acknowledged_through" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BriefAcknowledgement_user_id_project_id_key" ON "BriefAcknowledgement"("user_id", "project_id");

CREATE INDEX "BriefAcknowledgement_user_id_idx" ON "BriefAcknowledgement"("user_id");

CREATE INDEX "BriefAcknowledgement_project_id_idx" ON "BriefAcknowledgement"("project_id");

CREATE INDEX "BriefAcknowledgement_acknowledged_through_idx" ON "BriefAcknowledgement"("acknowledged_through");

ALTER TABLE "BriefAcknowledgement" ADD CONSTRAINT "BriefAcknowledgement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BriefAcknowledgement" ADD CONSTRAINT "BriefAcknowledgement_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
