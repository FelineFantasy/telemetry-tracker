-- Speeds up per-label existence checks and distinct-app counts for plan enforcement.
CREATE INDEX "Session_project_id_app_idx" ON "Session"("project_id", "app");
CREATE INDEX "ErrorGroup_project_id_app_idx" ON "ErrorGroup"("project_id", "app");
