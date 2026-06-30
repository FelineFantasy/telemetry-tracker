import { fetchAppNavSummariesForLayout } from "@/lib/app-nav-summary-server";
import { fetchProjectNavSummariesForLayout } from "@/lib/project-nav-summary-server";
import type { OrgOption, ProjectOption } from "@/lib/dashboard-workspace-types";
import { NavScopePickers } from "./NavScopePickers";

export async function NavScopePickersLoader({
  organizations,
  currentOrganizationId,
  projects,
  currentProjectId,
  environments,
  apps,
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
  projects: ProjectOption[];
  currentProjectId: string;
  environments: string[];
  apps: string[];
}) {
  const [projectNavSummaries, appNavSummaries] = await Promise.all([
    fetchProjectNavSummariesForLayout(currentOrganizationId),
    currentProjectId === ""
      ? Promise.resolve({})
      : fetchAppNavSummariesForLayout(currentProjectId, currentOrganizationId),
  ]);

  return (
    <NavScopePickers
      organizations={organizations}
      currentOrganizationId={currentOrganizationId}
      projects={projects}
      currentProjectId={currentProjectId}
      environments={environments}
      apps={apps}
      projectNavSummaries={projectNavSummaries}
      appNavSummaries={appNavSummaries}
    />
  );
}
