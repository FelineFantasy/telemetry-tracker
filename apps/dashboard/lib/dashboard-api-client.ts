"use client";

import { API_BASE_URL } from "@/lib/api-url";

/** Cookie storing the active dashboard project (matches API `X-Project-Id`). */
const TELEMETRY_PROJECT_COOKIE = "telemetry_project_id";

/** Opaque session id (matches API `UserSession.id` / `Authorization: Bearer`). */
const TELEMETRY_SESSION_COOKIE = "telemetry_session";

/** Cookie storing the active dashboard organization (matches API `X-Organization-Id`). */
const TELEMETRY_ORG_COOKIE = "telemetry_organization_id";

const PROJECT_UUID_RE = /^[0-9a-f-]{36}$/i;

function readBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

function optionalDashboardProjectHeader(
  projectId: string | undefined
): Record<string, string> {
  const trimmed = projectId?.trim();
  if (!trimmed || !PROJECT_UUID_RE.test(trimmed)) return {};
  return { "X-Project-Id": trimmed.toLowerCase() };
}

/** Browser fetch to the telemetry API with session/project/org headers from cookies. */
export async function dashboardApiClientFetch(
  pathAndQuery: string,
  init?: RequestInit
): Promise<Response> {
  const sessionId = readBrowserCookie(TELEMETRY_SESSION_COOKIE);
  const projectId = readBrowserCookie(TELEMETRY_PROJECT_COOKIE);
  const orgId = readBrowserCookie(TELEMETRY_ORG_COOKIE);

  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${API_BASE_URL}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;

  const headers: Record<string, string> = {
    ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}),
    ...optionalDashboardProjectHeader(projectId),
    ...(orgId && PROJECT_UUID_RE.test(orgId)
      ? { "X-Organization-Id": orgId.toLowerCase() }
      : {}),
  };

  return fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...headers,
      ...init?.headers,
    },
  });
}
