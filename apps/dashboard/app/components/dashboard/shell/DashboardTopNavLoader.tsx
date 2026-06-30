import { fetchDashboardBootstrap } from "@/lib/dashboard-bootstrap-server";
import { dashboardDebug } from "@/lib/dashboard-debug";
import { getDashboardProjectCookie } from "@/lib/dashboard-project";
import {
  fetchDashboardNavScope,
  getDashboardWorkspaceForRequest,
} from "@/lib/dashboard-workspace-request";
import { DashboardTopNav } from "./DashboardTopNav";

export async function DashboardTopNavLoader() {
  const started = Date.now();
  dashboardDebug("top-nav", "load start");

  const [workspace, bootstrap, cookieProjectId] = await Promise.all([
    getDashboardWorkspaceForRequest(),
    fetchDashboardBootstrap(),
    getDashboardProjectCookie(),
  ]);

  const { organizations, projects, resolvedOrgId, effectiveProjectId } = workspace;
  const user = bootstrap?.user ?? null;

  dashboardDebug("top-nav", "bootstrap + workspace", {
    ms: Date.now() - started,
    hasBootstrap: bootstrap !== null,
    hasUser: user !== null,
    orgCount: organizations.length,
    projectCount: projects.length,
    effectiveProjectId,
  });

  let navScope = { apps: [] as string[], environments: [] as string[] };
  if (effectiveProjectId !== "") {
    const cookieMatchesEffective =
      !cookieProjectId ||
      cookieProjectId.toLowerCase() === effectiveProjectId.toLowerCase();
    navScope =
      cookieMatchesEffective && bootstrap?.navScope
        ? bootstrap.navScope
        : await fetchDashboardNavScope(effectiveProjectId, resolvedOrgId);
  }

  return (
    <DashboardTopNav
      organizations={organizations}
      currentOrganizationId={resolvedOrgId}
      projects={projects}
      currentProjectId={effectiveProjectId}
      user={user}
      environments={navScope.environments}
      apps={navScope.apps}
    />
  );
}
