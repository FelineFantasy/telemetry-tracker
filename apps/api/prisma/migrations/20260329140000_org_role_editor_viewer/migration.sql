-- Replace OrgRole ADMIN/MEMBER with EDITOR/VIEWER (Sentry-style RBAC).

CREATE TYPE "OrgRole_new" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

ALTER TABLE "OrganizationMembership" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "OrganizationMembership"
  ALTER COLUMN "role" TYPE "OrgRole_new"
  USING (
    CASE "role"::text
      WHEN 'OWNER' THEN 'OWNER'::"OrgRole_new"
      WHEN 'ADMIN' THEN 'EDITOR'::"OrgRole_new"
      WHEN 'MEMBER' THEN 'VIEWER'::"OrgRole_new"
      ELSE 'VIEWER'::"OrgRole_new"
    END
  );

ALTER TABLE "OrganizationMembership"
  ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"OrgRole_new";

DROP TYPE "OrgRole";

ALTER TYPE "OrgRole_new" RENAME TO "OrgRole";
