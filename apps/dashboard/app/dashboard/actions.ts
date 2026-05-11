"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/api-url";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { TELEMETRY_ORG_COOKIE } from "@/lib/dashboard-org";
import {
  DEFAULT_PROJECT_ID,
  TELEMETRY_PROJECT_COOKIE,
  getDashboardProjectId,
  getDashboardSessionId,
} from "@/lib/dashboard-project";

/**
 * App names for `projectId` (must match sidebar project; API also checks org header vs project).
 * Returns `null` when the request fails or the body is unusable — callers should keep layout-provided
 * apps instead of treating that as “zero apps”.
 */
export async function loadDashboardApps(
  projectId: string,
  organizationId?: string | null
): Promise<string[] | null> {
  const trimmed = projectId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) return null;
  const orgTrimmed = organizationId?.trim();
  let res: Response;
  try {
    res = await dashboardApiFetch("/api/apps", undefined, {
      projectIdOverride: trimmed,
      ...(orgTrimmed && /^[0-9a-f-]{36}$/i.test(orgTrimmed)
        ? { organizationIdOverride: orgTrimmed.toLowerCase() }
        : {}),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const apps = (data as { apps?: unknown }).apps;
  return Array.isArray(apps) ? (apps as string[]) : null;
}

export async function setDashboardProjectId(projectId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const trimmed = projectId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) {
    return { ok: false, error: "Invalid project id" };
  }
  const c = await cookies();
  c.set(TELEMETRY_PROJECT_COOKIE, trimmed.toLowerCase(), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/** Clear cookie → API falls back to default project. */
export async function resetDashboardProjectId(): Promise<void> {
  const c = await cookies();
  c.set(TELEMETRY_PROJECT_COOKIE, DEFAULT_PROJECT_ID, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/dashboard", "layout");
}

const cookieOpts = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 400,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/**
 * After switching active org (or creating one), choose a `telemetry_project_id` that is valid for
 * session-context: prefer a project in `orgId`; if that org has no projects, fall back to any
 * project the user can access so we do not keep a stale project from another org.
 */
async function resolveProjectCookieForOrganization(
  sessionId: string,
  orgId: string,
  currentProjectId: string,
  /** When set, parsed org-scoped `/meta/projects` body (same scope as verify with `X-Organization-Id` for `orgId`). */
  orgScopedProjectsPayload?: { projects?: { id: string }[] }
): Promise<string> {
  const trimmedOrg = orgId.trim().toLowerCase();
  let data: { projects?: { id: string }[] };
  if (orgScopedProjectsPayload !== undefined) {
    data = orgScopedProjectsPayload;
  } else {
    const res = await fetch(`${API_BASE_URL}/api/meta/projects`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${sessionId}`,
        "X-Project-Id": currentProjectId,
        "X-Organization-Id": trimmedOrg,
      },
    });
    if (!res.ok) return currentProjectId;
    data = (await res.json()) as { projects?: { id: string }[] };
  }
  const inOrgIds = data.projects?.map((p) => p.id) ?? [];
  const current = currentProjectId.toLowerCase();
  if (inOrgIds.some((id) => id.toLowerCase() === current)) {
    return currentProjectId;
  }
  if (inOrgIds.length > 0) {
    return inOrgIds[0];
  }
  const resAll = await fetch(`${API_BASE_URL}/api/meta/projects`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "X-Project-Id": currentProjectId,
    },
  });
  if (!resAll.ok) return DEFAULT_PROJECT_ID;
  const allData = (await resAll.json()) as { projects?: { id: string }[] };
  const all = allData.projects ?? [];
  const first = all[0]?.id;
  return first ?? DEFAULT_PROJECT_ID;
}

export async function setDashboardOrganizationId(
  organizationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = organizationId.trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) {
    return { ok: false, error: "Invalid organization id" };
  }
  const sessionId = await getDashboardSessionId();
  if (!sessionId) {
    return { ok: false, error: "Not signed in" };
  }
  const projectId = await getDashboardProjectId();
  const verify = await fetch(`${API_BASE_URL}/api/meta/projects`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionId}`,
      "X-Project-Id": projectId,
      "X-Organization-Id": trimmed,
    },
  });
  if (!verify.ok) {
    const t = await verify.text();
    return { ok: false, error: t.slice(0, 200) || "Could not verify organization" };
  }
  const verifyData = (await verify.json()) as { projects?: { id: string }[] };
  const nextProject = await resolveProjectCookieForOrganization(
    sessionId,
    trimmed,
    projectId,
    verifyData
  );
  const c = await cookies();
  c.set(TELEMETRY_ORG_COOKIE, trimmed, cookieOpts);
  if (nextProject.toLowerCase() !== projectId.toLowerCase()) {
    c.set(TELEMETRY_PROJECT_COOKIE, nextProject.toLowerCase(), cookieOpts);
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function createOrganizationAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }
  const res = await dashboardApiFetch("/api/meta/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.slice(0, 120) }),
  });
  if (!res.ok) {
    return;
  }
  const data = (await res.json()) as { id?: string };
  if (data.id) {
    const orgId = data.id.toLowerCase();
    const c = await cookies();
    c.set(TELEMETRY_ORG_COOKIE, orgId, cookieOpts);
    const sessionId = await getDashboardSessionId();
    const projectId = await getDashboardProjectId();
    if (sessionId) {
      const nextProject = await resolveProjectCookieForOrganization(sessionId, orgId, projectId);
      if (nextProject.toLowerCase() !== projectId.toLowerCase()) {
        c.set(TELEMETRY_PROJECT_COOKIE, nextProject.toLowerCase(), cookieOpts);
      }
    }
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings/organization");
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId) || !name) {
    return;
  }
  const body: { organizationId: string; name: string; slug?: string } = {
    organizationId,
    name: name.slice(0, 120),
  };
  if (slugRaw) {
    body.slug = slugRaw.slice(0, 120);
  }
  const res = await dashboardApiFetch("/api/meta/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return;
  }
  const data = (await res.json()) as { id?: string };
  if (data.id) {
    const c = await cookies();
    c.set(TELEMETRY_PROJECT_COOKIE, data.id.toLowerCase(), cookieOpts);
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings/organization");
}

export async function inviteOrganizationMemberAction(
  _prev: { ok: boolean; error?: string; inviteUrl?: string } | null,
  formData: FormData
): Promise<
  | { ok: true; inviteUrl?: string }
  | { ok: false; error: string }
> {
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "VIEWER").trim();
  if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
    return { ok: false, error: "Invalid organization" };
  }
  if (!email.includes("@")) {
    return { ok: false, error: "Valid email is required" };
  }
  const res = await dashboardApiFetch(
    `/api/meta/organizations/${organizationId}/members`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 400) || res.statusText };
  }
  const data = (await res.json()) as {
    status?: string;
    inviteUrl?: string;
  };
  revalidatePath("/dashboard/settings/team");
  if (data.status === "invited" && data.inviteUrl) {
    return { ok: true, inviteUrl: data.inviteUrl };
  }
  return { ok: true };
}

export async function updateOrganizationMemberRoleAction(
  organizationId: string,
  userId: string,
  role: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const oid = organizationId.trim();
  const uid = userId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(oid) || !/^[0-9a-f-]{36}$/i.test(uid)) {
    return { ok: false, error: "Invalid id" };
  }
  const res = await dashboardApiFetch(
    `/api/meta/organizations/${oid}/members/${uid}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }
  );
  if (res.status === 204) {
    revalidatePath("/dashboard/settings/team");
    return { ok: true };
  }
  const t = await res.text();
  return { ok: false, error: t.slice(0, 400) || res.statusText };
}

export type CreateApiKeyResult =
  | { ok: true; key: string; publicId: string; name: string | null }
  | { ok: false; error: string };

export async function createDashboardApiKey(
  _prev: CreateApiKeyResult | null,
  formData: FormData
): Promise<CreateApiKeyResult> {
  const raw = formData.get("name");
  const name =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim().slice(0, 120) : undefined;
  const allowedRaw = formData.get("allowedApp");
  const allowedApp =
    typeof allowedRaw === "string" && allowedRaw.trim() !== ""
      ? allowedRaw.trim().slice(0, 64)
      : undefined;
  const payload: { name?: string; allowedApp?: string } = {};
  if (name) payload.name = name;
  if (allowedApp) payload.allowedApp = allowedApp;
  const res = await dashboardApiFetch("/api/project/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 400) || res.statusText };
  }
  const data = (await res.json()) as {
    key: string;
    publicId: string;
    name: string | null;
  };
  revalidatePath("/dashboard/settings/keys");
  return {
    ok: true,
    key: data.key,
    publicId: data.publicId,
    name: data.name,
  };
}

export async function setErrorResolvedAction(
  errorGroupId: string,
  resolved: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await dashboardApiFetch(`/api/errors/${errorGroupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolved }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 400) || res.statusText };
  }
  revalidatePath(`/dashboard/errors/${errorGroupId}`);
  revalidatePath("/dashboard/errors");
  return { ok: true };
}

export async function revokeDashboardApiKey(
  publicId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = publicId.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return { ok: false, error: "Invalid key id" };
  }
  const res = await dashboardApiFetch(`/api/project/api-keys/${id}/revoke`, {
    method: "POST",
  });
  if (res.status === 204) {
    revalidatePath("/dashboard/settings/keys");
    return { ok: true };
  }
  const t = await res.text();
  return { ok: false, error: t.slice(0, 400) || res.statusText };
}
