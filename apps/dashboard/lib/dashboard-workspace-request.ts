import { cache } from "react";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  fetchDashboardOrganizationsList,
  getDashboardOrganizationId,
  resolveActiveOrganizationId,
} from "@/lib/dashboard-org";
import { getDashboardProjectId } from "@/lib/dashboard-project";

export type DashboardOrgRow = { id: string; name: string };

export type DashboardProjectRow = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

async function fetchOrganizations(): Promise<DashboardOrgRow[]> {
  return fetchDashboardOrganizationsList();
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
 * Resolves sidebar org, project list for that org, and `effectiveProjectId` aligned with the
 * selected organization when the project cookie points at another org’s project.
 * Does not mutate cookies — Next.js Server Components cannot call `cookies().set()`; pass
 * `effectiveProjectId` / `resolvedOrgId` into `dashboardApiFetch` via overrides instead.
 * Wrapped in `cache` so the dashboard layout and nested pages share one resolution per request.
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
