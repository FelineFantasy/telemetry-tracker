-- Multi-tenant: Organization → Project → telemetry rows + API keys + monthly usage.
-- Existing rows are backfilled to a default project (same TELEMETRY_PROJECT_ID as apps/api/src/lib/project-scope.ts).

CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'BUSINESS');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan_tier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_stripe_customer_id_key" ON "Organization"("stripe_customer_id");

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_organization_id_idx" ON "Project"("organization_id");

CREATE UNIQUE INDEX "Project_organization_id_slug_key" ON "Project"("organization_id", "slug");

ALTER TABLE "Project" ADD CONSTRAINT "Project_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Organization" ("id", "name", "plan_tier", "created_at", "updated_at")
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    'Default organization',
    'FREE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO "Project" ("id", "organization_id", "name", "slug", "created_at", "updated_at")
VALUES (
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'Default project',
    'default',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

ALTER TABLE "Event" ADD COLUMN "project_id" TEXT;
ALTER TABLE "Session" ADD COLUMN "project_id" TEXT;
ALTER TABLE "ErrorGroup" ADD COLUMN "project_id" TEXT;

UPDATE "Event" SET "project_id" = 'a0000000-0000-4000-8000-000000000002' WHERE "project_id" IS NULL;
UPDATE "Session" SET "project_id" = 'a0000000-0000-4000-8000-000000000002' WHERE "project_id" IS NULL;
UPDATE "ErrorGroup" SET "project_id" = 'a0000000-0000-4000-8000-000000000002' WHERE "project_id" IS NULL;

DROP INDEX IF EXISTS "ErrorGroup_fingerprint_key";

ALTER TABLE "Event" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "ErrorGroup" ALTER COLUMN "project_id" SET NOT NULL;

CREATE UNIQUE INDEX "ErrorGroup_project_id_fingerprint_key" ON "ErrorGroup"("project_id", "fingerprint");

ALTER TABLE "Event" ADD CONSTRAINT "Event_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ErrorGroup" ADD CONSTRAINT "ErrorGroup_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Event_project_id_created_at_idx" ON "Event"("project_id", "created_at");
CREATE INDEX "Event_project_id_app_idx" ON "Event"("project_id", "app");
CREATE INDEX "ErrorGroup_project_id_last_seen_idx" ON "ErrorGroup"("project_id", "last_seen");
CREATE INDEX "Session_project_id_started_at_idx" ON "Session"("project_id", "started_at");

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT,
    "public_id" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_public_id_key" ON "ApiKey"("public_id");

CREATE INDEX "ApiKey_project_id_idx" ON "ApiKey"("project_id");

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UsageMonthly" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "ingest_units" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageMonthly_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsageMonthly_year_month_idx" ON "UsageMonthly"("year_month");

CREATE UNIQUE INDEX "UsageMonthly_project_id_year_month_key" ON "UsageMonthly"("project_id", "year_month");

ALTER TABLE "UsageMonthly" ADD CONSTRAINT "UsageMonthly_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
