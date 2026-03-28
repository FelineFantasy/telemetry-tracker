/**
 * Default project created by migration `20260328210000_org_project_api_keys`.
 * Override with TELEMETRY_PROJECT_ID for reads when multiple projects exist.
 */
export const DEFAULT_LEGACY_PROJECT_ID = "a0000000-0000-4000-8000-000000000002";

export function readProjectIdFromEnv(): string {
  const v = process.env.TELEMETRY_PROJECT_ID?.trim();
  return v && v.length > 0 ? v : DEFAULT_LEGACY_PROJECT_ID;
}
