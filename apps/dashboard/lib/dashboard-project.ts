import { cookies } from "next/headers";

/** Cookie storing the active dashboard project (matches API `X-Project-Id`). */
export const TELEMETRY_PROJECT_COOKIE = "telemetry_project_id";

/** Opaque session id (matches API `UserSession.id` / `Authorization: Bearer`). */
export const TELEMETRY_SESSION_COOKIE = "telemetry_session";

/** Default from migration + `TELEMETRY_PROJECT_ID` (same as API `readProjectIdFromEnv`). */
export const DEFAULT_PROJECT_ID =
  process.env.TELEMETRY_PROJECT_ID?.trim() ||
  "a0000000-0000-4000-8000-000000000002";

export const PROJECT_UUID_RE = /^[0-9a-f-]{36}$/i;

export function isValidDashboardProjectId(
  projectId: string | undefined | null
): projectId is string {
  const trimmed = projectId?.trim();
  return !!trimmed && PROJECT_UUID_RE.test(trimmed);
}

/** Omit `X-Project-Id` when empty or invalid so the API does not fall back to the env default project. */
export function optionalDashboardProjectHeader(
  projectId: string | undefined | null
): Record<string, string> {
  if (!isValidDashboardProjectId(projectId)) return {};
  return { "X-Project-Id": projectId.trim().toLowerCase() };
}

export function sessionScopedMetaHeaders(
  sessionId: string,
  options?: { projectId?: string; organizationId?: string }
): Record<string, string> {
  const org = options?.organizationId?.trim().toLowerCase();
  return {
    Authorization: `Bearer ${sessionId}`,
    ...optionalDashboardProjectHeader(options?.projectId),
    ...(org && PROJECT_UUID_RE.test(org) ? { "X-Organization-Id": org } : {}),
  };
}

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
  const cookie = await getDashboardProjectCookie();
  const { getDashboardWorkspaceForRequest } = await import("./dashboard-workspace-request");
  const { projects, effectiveProjectId } = await getDashboardWorkspaceForRequest();
  if (
    cookie &&
    isValidDashboardProjectId(cookie) &&
    projects.some((p) => p.id.toLowerCase() === cookie.toLowerCase())
  ) {
    return cookie.trim().toLowerCase();
  }
  return effectiveProjectId;
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
  return optionalDashboardProjectHeader(projectId);
}
