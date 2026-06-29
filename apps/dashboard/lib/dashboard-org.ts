import { cache } from "react";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api-url";
import { getDashboardSessionId } from "@/lib/dashboard-project";

/** Cookie storing the active dashboard organization (matches API `X-Organization-Id`). */
export const TELEMETRY_ORG_COOKIE = "telemetry_organization_id";

export type DashboardOrganizationRow = { id: string; name: string };

type MetaOrganizationsPayload =
  | { ok: true; organizations: DashboardOrganizationRow[] }
  | { ok: false };

/**
 * Single GET /api/meta/organizations per request — shared by workspace layout, org list helpers,
 * and `getResolvedDashboardOrganizationId`.
 */
const getMetaOrganizationsPayload = cache(async (): Promise<MetaOrganizationsPayload> => {
  const sessionId = await getDashboardSessionId();
  if (!sessionId) return { ok: true, organizations: [] };
  const res = await fetch(`${API_BASE_URL}/api/meta/organizations`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionId}`,
    },
  });
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as {
    organizations?: { id: string; name?: string }[];
  };
  const raw = Array.isArray(data.organizations) ? data.organizations : [];
  const organizations = raw.map((o) => ({
    id: o.id,
    name: typeof o.name === "string" ? o.name : "",
  }));
  return { ok: true, organizations };
});

export async function fetchDashboardOrganizationsList(): Promise<DashboardOrganizationRow[]> {
  const p = await getMetaOrganizationsPayload();
  return p.ok ? p.organizations : [];
}

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
    const p = await getMetaOrganizationsPayload();
    if (!p.ok) {
      return cookieOrg;
    }
    const resolved = resolveActiveOrganizationId(cookieOrg, p.organizations);
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
