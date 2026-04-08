import { cookies } from "next/headers";

/** Cookie storing the active dashboard organization (matches API `X-Organization-Id`). */
export const TELEMETRY_ORG_COOKIE = "telemetry_organization_id";

export async function getDashboardOrganizationId(): Promise<string | undefined> {
  const c = await cookies();
  const v = c.get(TELEMETRY_ORG_COOKIE)?.value?.trim();
  if (v && /^[0-9a-f-]{36}$/i.test(v)) {
    return v.toLowerCase();
  }
  return undefined;
}

/**
 * Match cookie id (lowercased) to API org ids (any casing). Returns canonical id from the list.
 */
export function resolveActiveOrganizationId(
  cookieOrgId: string | undefined,
  organizations: readonly { id: string }[]
): string | null {
  if (organizations.length === 0) return null;
  if (cookieOrgId) {
    const lower = cookieOrgId.toLowerCase();
    const found = organizations.find((o) => o.id.toLowerCase() === lower);
    if (found) return found.id;
  }
  return organizations[0]!.id;
}
