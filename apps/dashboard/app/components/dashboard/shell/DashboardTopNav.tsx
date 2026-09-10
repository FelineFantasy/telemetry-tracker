import { Suspense } from "react";
import type { OrgOption, ProjectOption } from "@/lib/dashboard-workspace-types";
import type { DashboardUser } from "@/lib/dashboard-user";
import { DashboardChrome } from "./DashboardChrome";
import { NavScopePickersLoader } from "./NavScopePickersLoader";
import { NavScopePickersSkeleton } from "./NavScopePickersSkeleton";

export function DashboardTopNav({
  organizations,
  currentOrganizationId,
  projects,
  currentProjectId,
  user,
  environments,
  apps,
  commandPaletteEnabled,
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
  projects: ProjectOption[];
  currentProjectId: string;
  user: DashboardUser | null;
  environments: string[];
  apps: string[];
  commandPaletteEnabled: boolean;
}) {
  const pickerProps = {
    organizations,
    currentOrganizationId,
    projects,
    currentProjectId,
    environments,
    apps,
  };

  return (
    <DashboardChrome
      currentOrganizationId={currentOrganizationId}
      currentProjectId={currentProjectId}
      user={user}
      commandPaletteEnabled={commandPaletteEnabled}
      sidebarWorkspace={
        <Suspense fallback={<NavScopePickersSkeleton />}>
          <NavScopePickersLoader {...pickerProps} variant="sidebar" />
        </Suspense>
      }
      headerScope={
        <Suspense fallback={<NavScopePickersSkeleton />}>
          <NavScopePickersLoader {...pickerProps} variant="header" />
        </Suspense>
      }
    />
  );
}
