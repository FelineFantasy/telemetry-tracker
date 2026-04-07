import { API_BASE_URL } from "@/lib/api-url";
import { getDashboardOrganizationId } from "@/lib/dashboard-org";
import {
  dashboardApiHeaders,
  getDashboardProjectId,
  getDashboardSessionId,
} from "@/lib/dashboard-project";

/** Server-side fetch: `X-Project-Id` + optional `Authorization` + optional `X-Organization-Id` from cookies. */
export async function dashboardApiFetch(
  pathAndQuery: string,
  init?: RequestInit
): Promise<Response> {
  const projectId = await getDashboardProjectId();
  const sessionId = await getDashboardSessionId();
  const orgId = await getDashboardOrganizationId();
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
