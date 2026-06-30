import { cache } from "react";
import { fetchDashboardBootstrap } from "@/lib/dashboard-bootstrap-server";

/** Cookie storing the active dashboard organization (matches API `X-Organization-Id`). */
export const TELEMETRY_ORG_COOKIE = "telemetry_organization_id";

export type DashboardOrganizationRow = { id: string; name: string };

type MetaOrganizationsPayload =
  | { ok: true; organizations: DashboardOrganizationRow[] }
  | { ok: false };

/**
 * Org list from dashboard bootstrap — no separate GET /api/meta/organizations.
 */
const getMetaOrganizationsPayload = cache(async (): Promise<MetaOrganizationsPayload> => {
  const bootstrap = await fetchDashboardBootstrap();
  if (!bootstrap) return { ok: false };
  return { ok: true, organizations: bootstrap.organizations };
});

export async function fetchDashboardOrganizationsPayload(): Promise<MetaOrganizationsPayload> {
  return getMetaOrganizationsPayload();
}

export async function fetchDashboardOrganizationsList(): Promise<DashboardOrganizationRow[]> {
  const p = await getMetaOrganizationsPayload();
  return p.ok ? p.organizations : [];
}

export async function getDashboardOrganizationId(): Promise<string | undefined> {
  const { getAllowedDashboardOrganizationCookie } = await import("./cookie-consent-server");
  return getAllowedDashboardOrganizationCookie();
}

/**
 * Organization id aligned with the sidebar: cookie when valid, otherwise first membership.
 */
export const getResolvedDashboardOrganizationId = cache(
  async (): Promise<string | undefined> => {
    const cookieOrg = await getDashboardOrganizationId();
    const bootstrap = await fetchDashboardBootstrap();
    if (!bootstrap) return cookieOrg;
    const resolved = resolveActiveOrganizationId(cookieOrg, bootstrap.organizations);
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
