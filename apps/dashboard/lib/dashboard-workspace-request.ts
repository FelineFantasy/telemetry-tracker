import { cookies } from "next/headers";
import { cache } from "react";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  getDashboardOrganizationId,
  resolveActiveOrganizationId,
} from "@/lib/dashboard-org";
import {
  TELEMETRY_PROJECT_COOKIE,
  getDashboardProjectId,
} from "@/lib/dashboard-project";

const PROJECT_COOKIE_OPTS = {
  path: "/" as const,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 400,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

export type DashboardOrgRow = { id: string; name: string };

export type DashboardProjectRow = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

async function fetchOrganizations(): Promise<DashboardOrgRow[]> {
  const res = await dashboardApiFetch("/api/meta/organizations", undefined, {
    omitOrganizationHeader: true,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { organizations?: DashboardOrgRow[] };
  return Array.isArray(data.organizations) ? data.organizations : [];
}

async function fetchAllProjects(): Promise<DashboardProjectRow[]> {
  const res = await dashboardApiFetch("/api/meta/projects", undefined, {
    omitOrganizationHeader: true,
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw = Array.isArray(data.projects) ? data.projects : [];
  return raw.map(
    (p: { id: string; name: string; slug: string; organizationId?: string }) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      organizationId: p.organizationId ?? "",
    })
  );
}

/**
 * Resolves sidebar org, project list for that org, and an `effectiveProjectId` aligned with the
 * org cookie (may write the project cookie when the stored project belongs to another org).
 * Use before `getDashboardSessionContext` / `/api/apps` so `X-Project-Id` matches the same request’s cookies().
 * Wrapped in `cache` so the dashboard layout and nested pages (e.g. organization settings) share one resolution per request.
 */
export const getDashboardWorkspaceForRequest = cache(async function getDashboardWorkspaceForRequest(): Promise<{
  organizations: DashboardOrgRow[];
  projects: DashboardProjectRow[];
  resolvedOrgId: string | null;
  effectiveProjectId: string;
}> {
  const [cookieOrgId, currentProjectId] = await Promise.all([
    getDashboardOrganizationId(),
    getDashboardProjectId(),
  ]);

  const [organizations, allProjects] = await Promise.all([
    fetchOrganizations(),
    fetchAllProjects(),
  ]);

  const resolvedOrgId = resolveActiveOrganizationId(cookieOrgId, organizations);

  const projects =
    resolvedOrgId !== null
      ? allProjects.filter(
          (p) => p.organizationId.toLowerCase() === resolvedOrgId.toLowerCase(),
        )
      : allProjects;

  let effectiveProjectId: string;
  if (projects.length === 0) {
    effectiveProjectId = resolvedOrgId !== null ? "" : currentProjectId;
  } else if (projects.some((p) => p.id.toLowerCase() === currentProjectId.toLowerCase())) {
    effectiveProjectId = currentProjectId;
  } else {
    effectiveProjectId = projects[0]!.id;
    const c = await cookies();
    c.set(TELEMETRY_PROJECT_COOKIE, effectiveProjectId.toLowerCase(), PROJECT_COOKIE_OPTS);
  }

  return { organizations, projects, resolvedOrgId, effectiveProjectId };
});

export async function fetchDashboardAppsList(
  projectId: string,
  organizationId: string | null
): Promise<string[]> {
  const res = await dashboardApiFetch("/api/apps", undefined, {
    projectIdOverride: projectId,
    ...(organizationId ? { organizationIdOverride: organizationId } : {}),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.apps) ? data.apps : [];
}
