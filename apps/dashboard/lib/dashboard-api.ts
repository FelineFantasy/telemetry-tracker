import { API_BASE_URL } from "@/lib/api-url";
import { getResolvedDashboardOrganizationId } from "@/lib/dashboard-org";
import {
  dashboardApiHeaders,
  getDashboardProjectId,
  getDashboardSessionId,
} from "@/lib/dashboard-project";

const PROJECT_UUID_RE = /^[0-9a-f-]{36}$/i;

export type DashboardApiFetchOptions = {
  /** When true, do not send `X-Organization-Id` (avoids 403 from a stale org cookie on `/meta/projects`). */
  omitOrganizationHeader?: boolean;
  /**
   * Use this exact organization id as `X-Organization-Id` instead of calling `getResolvedDashboardOrganizationId`
   * (which fetches `/api/meta/organizations`). Prefer when the layout or a server action already knows the sidebar org.
   */
  organizationIdOverride?: string;
  /**
   * Use this exact project id as `X-Project-Id` instead of reading the cookie again — keeps `/api/apps`
   * and layout shell aligned when several cookie reads run in one request.
   */
  projectIdOverride?: string;
};

/** Server-side fetch: `X-Project-Id` + optional `Authorization` + optional `X-Organization-Id` from cookies. */
export async function dashboardApiFetch(
  pathAndQuery: string,
  init?: RequestInit,
  options?: DashboardApiFetchOptions
): Promise<Response> {
  const override = options?.projectIdOverride?.trim();
  const projectId =
    override && PROJECT_UUID_RE.test(override) ? override : await getDashboardProjectId();
  const sessionId = await getDashboardSessionId();
  const orgOverride = options?.organizationIdOverride?.trim();
  const orgId = options?.omitOrganizationHeader
    ? undefined
    : orgOverride && PROJECT_UUID_RE.test(orgOverride)
      ? orgOverride.toLowerCase()
      : await getResolvedDashboardOrganizationId();
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${API_BASE_URL}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const baseHeaders: Record<string, string> = {
    ...dashboardApiHeaders(projectId),
    ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}),
    ...(orgId ? { "X-Organization-Id": orgId } : {}),
  };
  return fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...baseHeaders,
      ...init?.headers,
    },
  });
}

export { API_BASE_URL as API_BASE };
