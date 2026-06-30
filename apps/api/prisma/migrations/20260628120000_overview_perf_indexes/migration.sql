-- Speed up membership lookups by user (workspace bootstrap).
CREATE INDEX IF NOT EXISTS "OrganizationMembership_user_id_idx" ON "OrganizationMembership"("user_id");

-- Speed up distinct environment scans for nav / filter-options.
CREATE INDEX IF NOT EXISTS "Event_project_id_environment_idx" ON "Event"("project_id", "environment");
CREATE INDEX IF NOT EXISTS "ErrorGroup_project_id_environment_idx" ON "ErrorGroup"("project_id", "environment");
