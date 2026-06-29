import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api-url";
import {
  fetchDashboardOrganizationsList,
  getDashboardOrganizationId,
  resolveActiveOrganizationId,
} from "@/lib/dashboard-org";

/** Cookie storing the active dashboard project (matches API `X-Project-Id`). */
export const TELEMETRY_PROJECT_COOKIE = "telemetry_project_id";

/** Opaque session id (matches API `UserSession.id` / `Authorization: Bearer`). */
export const TELEMETRY_SESSION_COOKIE = "telemetry_session";

/** Default from migration + `TELEMETRY_PROJECT_ID` (same as API `readProjectIdFromEnv`). */
export const DEFAULT_PROJECT_ID =
  process.env.TELEMETRY_PROJECT_ID?.trim() ||
  "a0000000-0000-4000-8000-000000000002";

export async function getDashboardProjectCookie(): Promise<string | undefined> {
  const { getAllowedDashboardProjectCookie } = await import("./cookie-consent-server");
  return getAllowedDashboardProjectCookie();
}

export function resolveEffectiveProjectId(
  cookieProjectId: string | undefined,
  projects: readonly { id: string }[]
): string {
  if (projects.length === 0) return "";
  if (
    cookieProjectId &&
    projects.some((p) => p.id.toLowerCase() === cookieProjectId.toLowerCase())
  ) {
    return cookieProjectId;
  }
  return projects[0]!.id;
}

export async function getDashboardProjectId(): Promise<string> {
  const cookieProjectId = await getDashboardProjectCookie();
  if (cookieProjectId) return cookieProjectId;

  const sessionId = await getDashboardSessionId();
  if (!sessionId) return DEFAULT_PROJECT_ID;

  const [cookieOrgId, organizations] = await Promise.all([
    getDashboardOrganizationId(),
    fetchDashboardOrganizationsList(),
  ]);
  const resolvedOrgId = resolveActiveOrganizationId(cookieOrgId, organizations);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${sessionId}`,
  };
  if (resolvedOrgId) {
    headers["X-Organization-Id"] = resolvedOrgId;
  }

  const res = await fetch(`${API_BASE_URL}/api/meta/projects`, {
    cache: "no-store",
    headers,
  });
  if (!res.ok) return DEFAULT_PROJECT_ID;

  const data = (await res.json()) as { projects?: { id: string }[] };
  const projects = data.projects ?? [];
  return resolveEffectiveProjectId(undefined, projects) || DEFAULT_PROJECT_ID;
}

export async function getDashboardSessionId(): Promise<string | undefined> {
  const c = await cookies();
  const v = c.get(TELEMETRY_SESSION_COOKIE)?.value?.trim();
  if (v && /^[0-9a-f-]{36}$/i.test(v)) {
    return v;
  }
  return undefined;
}

export function dashboardApiHeaders(projectId: string): Record<string, string> {
  return { "X-Project-Id": projectId };
}
