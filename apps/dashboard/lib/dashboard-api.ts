import { API_BASE_URL } from "@/lib/api-url";
import {
  dashboardApiHeaders,
  getDashboardProjectId,
} from "@/lib/dashboard-project";

/** Server-side fetch to the telemetry API with `X-Project-Id` from the dashboard cookie. */
export async function dashboardApiFetch(
  pathAndQuery: string,
  init?: RequestInit
): Promise<Response> {
  const projectId = await getDashboardProjectId();
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${API_BASE_URL}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  return fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...dashboardApiHeaders(projectId),
      ...init?.headers,
    },
  });
}

export { API_BASE_URL as API_BASE };
