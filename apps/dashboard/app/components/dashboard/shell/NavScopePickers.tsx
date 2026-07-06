"use client";

import { TopNavAppSwitcher } from "./TopNavAppSwitcher";
import { TopNavOrgSwitcher } from "./TopNavOrgSwitcher";
import { TopNavProjectSwitcher } from "./TopNavProjectSwitcher";
import { DashboardEnvSelector } from "./DashboardEnvSelector";
import type { OrgOption, ProjectOption } from "@/lib/dashboard-workspace-types";
import type { AppNavSummary } from "@/lib/app-nav-summary-types";
import type { ProjectNavSummary } from "@/lib/project-nav-summary-types";

export function NavScopePickers({
  organizations,
  currentOrganizationId,
  projects,
  currentProjectId,
  environments,
  apps,
  projectNavSummaries,
  appNavSummaries,
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
  projects: ProjectOption[];
  currentProjectId: string;
  environments: string[];
  apps: string[];
  projectNavSummaries: Record<string, ProjectNavSummary>;
  appNavSummaries: Record<string, AppNavSummary>;
}) {
  return (
    <div className="flex w-max items-center gap-1.5 sm:w-auto sm:min-w-0 [&_button]:shrink-0 sm:[&_button]:shrink">
      <TopNavOrgSwitcher
        organizations={organizations}
        currentOrganizationId={currentOrganizationId}
      />
      <TopNavProjectSwitcher
        projects={projects}
        currentProjectId={currentProjectId}
        projectNavSummaries={projectNavSummaries}
      />
      <TopNavAppSwitcher
        apps={apps}
        projectId={currentProjectId}
        appNavSummaries={appNavSummaries}
        projectNavSummaries={projectNavSummaries}
      />
      <DashboardEnvSelector environments={environments} />
    </div>
  );
}
