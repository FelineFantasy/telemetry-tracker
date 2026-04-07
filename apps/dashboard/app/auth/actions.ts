"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-url";
import { TELEMETRY_ORG_COOKIE } from "@/lib/dashboard-org";
import {
  TELEMETRY_PROJECT_COOKIE,
  TELEMETRY_SESSION_COOKIE,
  getDashboardSessionId,
} from "@/lib/dashboard-project";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const PROJECT_MAX_AGE = 60 * 60 * 24 * 400;

async function fetchFirstProjectAndOrg(sessionId: string): Promise<{
  projectId?: string;
  organizationId?: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/meta/projects`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${sessionId}` },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    projects?: { id: string; organizationId?: string }[];
  };
  const p = data.projects?.[0];
  if (!p) return {};
  return {
    projectId: p.id,
    organizationId: p.organizationId,
  };
}

function cookieBase() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function login(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    sessionId?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Login failed" };
  }
  const sessionId = data.sessionId;
  if (!sessionId) {
    return { ok: false, error: "Invalid response from server" };
  }
  const c = await cookies();
  c.set(TELEMETRY_SESSION_COOKIE, sessionId, {
    ...cookieBase(),
    maxAge: SESSION_MAX_AGE,
  });
  const { projectId, organizationId } = await fetchFirstProjectAndOrg(sessionId);
  if (projectId) {
    c.set(TELEMETRY_PROJECT_COOKIE, projectId, {
      ...cookieBase(),
      maxAge: PROJECT_MAX_AGE,
    });
  }
  if (organizationId) {
    c.set(TELEMETRY_ORG_COOKIE, organizationId.toLowerCase(), {
      ...cookieBase(),
      maxAge: PROJECT_MAX_AGE,
    });
  }
  return { ok: true };
}

export async function register(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayNameRaw = String(formData.get("displayName") ?? "").trim();
  const displayName = displayNameRaw ? displayNameRaw.slice(0, 120) : undefined;
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      displayName,
      ...(inviteToken ? { inviteToken } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    sessionId?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Registration failed" };
  }
  const sessionId = data.sessionId;
  if (!sessionId) {
    return { ok: false, error: "Invalid response from server" };
  }
  const c = await cookies();
  c.set(TELEMETRY_SESSION_COOKIE, sessionId, {
    ...cookieBase(),
    maxAge: SESSION_MAX_AGE,
  });
  const { projectId, organizationId } = await fetchFirstProjectAndOrg(sessionId);
  if (projectId) {
    c.set(TELEMETRY_PROJECT_COOKIE, projectId, {
      ...cookieBase(),
      maxAge: PROJECT_MAX_AGE,
    });
  }
  if (organizationId) {
    c.set(TELEMETRY_ORG_COOKIE, organizationId.toLowerCase(), {
      ...cookieBase(),
      maxAge: PROJECT_MAX_AGE,
    });
  }
  return { ok: true };
}

export async function logout(): Promise<void> {
  const sid = await getDashboardSessionId();
  if (sid) {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sid}` },
    });
  }
  const c = await cookies();
  c.set(TELEMETRY_SESSION_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
