/** Seeded in `apps/api/prisma/migrations/20260328210000_org_project_api_keys/migration.sql` */
export const LEGACY_SEEDED_ORG_NAME = "Default organization";
export const LEGACY_SEEDED_PROJECT_NAME = "Default project";

/**
 * Sidebar rail: don’t surface meaningless seeded DB strings—show human labels instead.
 */
export function formatOrganizationRailName(name: string): string {
  return name === LEGACY_SEEDED_ORG_NAME ? "Your workspace" : name;
}

/**
 * Prefer real names; for the seeded default row, use a label that says what it is (install seed),
 * not a marketing term like “primary”.
 */
export function formatProjectRailName(name: string, slug: string): string {
  if (name === LEGACY_SEEDED_PROJECT_NAME && slug === "default") {
    return "Initial project";
  }
  return name;
}
