-- Session geo/device context and optional user email (#192)
ALTER TABLE "Session" ADD COLUMN "country" TEXT;
ALTER TABLE "Session" ADD COLUMN "device_browser" TEXT;
ALTER TABLE "Session" ADD COLUMN "device_os" TEXT;
ALTER TABLE "Session" ADD COLUMN "user_email" TEXT;

CREATE INDEX "Session_project_id_country_idx" ON "Session"("project_id", "country");
