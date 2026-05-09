import { cache } from "react";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api-url";
import {
  dashboardApiHeaders,
  getDashboardProjectId,
  getDashboardSessionId,
} from "@/lib/dashboard-project";

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
 * Organization id aligned with the sidebar: cookie when valid, otherwise first membership.
 * Sends this as `X-Organization-Id` so APIs match the workspace you see even when the org cookie
 * is missing or stale. Cached per request (React `cache`).
 */
export const getResolvedDashboardOrganizationId = cache(
  async (): Promise<string | undefined> => {
    const cookieOrg = await getDashboardOrganizationId();
    const sessionId = await getDashboardSessionId();
    if (!sessionId) {
      return cookieOrg;
    }
    const projectId = await getDashboardProjectId();
    const res = await fetch(`${API_BASE_URL}/api/meta/organizations`, {
      cache: "no-store",
      headers: {
        ...dashboardApiHeaders(projectId),
        Authorization: `Bearer ${sessionId}`,
      },
    });
    if (!res.ok) {
      return cookieOrg;
    }
    const data = (await res.json()) as { organizations?: { id: string }[] };
    const orgs = Array.isArray(data.organizations) ? data.organizations : [];
    const resolved = resolveActiveOrganizationId(cookieOrg, orgs);
    return resolved ?? undefined;
  }
);

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
