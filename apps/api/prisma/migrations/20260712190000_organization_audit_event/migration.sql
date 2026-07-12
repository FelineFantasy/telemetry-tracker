-- Org-scoped dashboard audit trail (settings / security MVP).
CREATE TABLE "OrganizationAuditEvent" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationAuditEvent_organization_id_created_at_id_idx" ON "OrganizationAuditEvent"("organization_id", "created_at" DESC, "id" DESC);
CREATE INDEX "OrganizationAuditEvent_actor_user_id_idx" ON "OrganizationAuditEvent"("actor_user_id");

ALTER TABLE "OrganizationAuditEvent" ADD CONSTRAINT "OrganizationAuditEvent_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationAuditEvent" ADD CONSTRAINT "OrganizationAuditEvent_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
