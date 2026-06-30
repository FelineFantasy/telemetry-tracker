import { cache } from "react";
import { fetchDashboardBootstrap } from "@/lib/dashboard-bootstrap-server";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  getDashboardOrganizationId,
  organizationCookieDiffersFromResolved,
  resolveActiveOrganizationId,
} from "@/lib/dashboard-org";
import {
  getDashboardProjectCookie,
  resolveEffectiveProjectId,
} from "@/lib/dashboard-project";

export type DashboardOrgRow = { id: string; name: string };

export type DashboardProjectRow = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

export type DashboardNavScope = {
  apps: string[];
  environments: string[];
};

/** One API call for org list + all accessible projects (replaces separate org + project fetches). */
export const fetchDashboardWorkspaceMeta = cache(async function fetchDashboardWorkspaceMeta(): Promise<{
  organizations: DashboardOrgRow[];
  allProjects: DashboardProjectRow[];
}> {
  const bootstrap = await fetchDashboardBootstrap();
  if (!bootstrap) return { organizations: [], allProjects: [] };
  return {
    organizations: bootstrap.organizations,
    allProjects: bootstrap.projects,
  };
});

/** Apps + environments for nav pickers (replaces separate /api/apps + /api/filter-options). */
export const fetchDashboardNavScope = cache(async function fetchDashboardNavScope(
  projectId: string,
  organizationId: string | null,
  app?: string | null
): Promise<DashboardNavScope> {
  const empty: DashboardNavScope = { apps: [], environments: [] };
  if (!projectId) return empty;

  const appFilter = app?.trim() || null;
  const path = appFilter
    ? `/api/meta/nav-scope?app=${encodeURIComponent(appFilter)}`
    : "/api/meta/nav-scope";

  const res = await dashboardApiFetch(path, undefined, {
    projectIdOverride: projectId,
    ...(organizationId ? { organizationIdOverride: organizationId } : {}),
  });
  if (!res.ok) return empty;

  const data = (await res.json()) as { apps?: string[]; environments?: string[] };
  return {
    apps: Array.isArray(data.apps) ? data.apps : [],
    environments: Array.isArray(data.environments) ? data.environments : [],
  };
});

const fetchProjectsForOrganization = cache(async function fetchProjectsForOrganization(
  organizationId: string
): Promise<DashboardProjectRow[]> {
  const res = await dashboardApiFetch("/api/meta/projects", undefined, {
    organizationIdOverride: organizationId,
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    projects?: {
      id: string;
      name: string;
      slug: string;
      organizationId?: string;
    }[];
  };

  if (!Array.isArray(data.projects)) return [];
  return data.projects.map((project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    organizationId: project.organizationId ?? organizationId,
  }));
});

/**
 * Resolves sidebar org, project list for that org, and `effectiveProjectId` aligned with the
 * selected organization when the project cookie points at another org’s project.
 */
export const getDashboardWorkspaceForRequest = cache(async function getDashboardWorkspaceForRequest(): Promise<{
  organizations: DashboardOrgRow[];
  projects: DashboardProjectRow[];
  resolvedOrgId: string | null;
  effectiveProjectId: string;
}> {
  const [cookieOrgId, cookieProjectId, bootstrap] = await Promise.all([
    getDashboardOrganizationId(),
    getDashboardProjectCookie(),
    fetchDashboardBootstrap(),
  ]);

  const organizations = bootstrap?.organizations ?? [];
  let allProjects = bootstrap?.projects ?? [];

  const resolvedOrgId = resolveActiveOrganizationId(cookieOrgId, organizations);

  if (
    allProjects.length === 0 &&
    resolvedOrgId !== null &&
    organizationCookieDiffersFromResolved(cookieOrgId, resolvedOrgId)
  ) {
    allProjects = await fetchProjectsForOrganization(resolvedOrgId);
  }

  const projects =
    resolvedOrgId !== null
      ? allProjects.filter(
          (p) => p.organizationId.toLowerCase() === resolvedOrgId.toLowerCase(),
        )
      : allProjects;

  const effectiveProjectId = resolveEffectiveProjectId(cookieProjectId, projects);

  return { organizations, projects, resolvedOrgId, effectiveProjectId };
});

export const fetchDashboardAppsList = cache(async function fetchDashboardAppsList(
  projectId: string,
  organizationId: string | null
): Promise<string[]> {
  const scope = await fetchDashboardNavScope(projectId, organizationId);
  return scope.apps;
});

export const fetchDashboardEnvironments = cache(async function fetchDashboardEnvironments(
  projectId: string,
  organizationId: string | null,
  app?: string | null
): Promise<string[]> {
  const scope = await fetchDashboardNavScope(projectId, organizationId, app);
  return scope.environments;
});
