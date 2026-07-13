-- Per-user experimental feature toggles (Settings → Labs).
ALTER TABLE "User" ADD COLUMN "labs_preferences" JSONB;
