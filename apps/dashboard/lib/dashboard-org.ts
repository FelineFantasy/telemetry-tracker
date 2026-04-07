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
