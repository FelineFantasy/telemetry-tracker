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
  variant = "header",
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
  projects: ProjectOption[];
  currentProjectId: string;
  environments: string[];
  apps: string[];
  projectNavSummaries: Record<string, ProjectNavSummary>;
  appNavSummaries: Record<string, AppNavSummary>;
  variant?: "sidebar" | "header";
}) {
  if (variant === "sidebar") {
    return (
      <div className="flex flex-col gap-1.5">
        <TopNavOrgSwitcher
          organizations={organizations}
          currentOrganizationId={currentOrganizationId}
          triggerClassName="w-full max-w-none"
        />
        <TopNavProjectSwitcher
          projects={projects}
          currentOrganizationId={currentOrganizationId}
          currentProjectId={currentProjectId}
          projectNavSummaries={projectNavSummaries}
          triggerClassName="w-full max-w-none"
        />
      </div>
    );
  }

  return (
    <div className="flex w-max items-center gap-1.5 sm:w-auto sm:min-w-0 [&_button]:shrink-0 sm:[&_button]:shrink">
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
