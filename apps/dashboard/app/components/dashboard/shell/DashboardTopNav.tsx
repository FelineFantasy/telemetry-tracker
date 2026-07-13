import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/app/components/marketing/logo";
import type { OrgOption, ProjectOption } from "@/lib/dashboard-workspace-types";
import type { DashboardUser } from "@/lib/dashboard-user";
import { DashboardNavTabs } from "./DashboardNavTabs";
import { DashboardTopNavActions } from "./DashboardTopNavActions";
import { DashboardNotificationsLoader } from "./DashboardNotificationsLoader";
import { NavScopePickersLoader } from "./NavScopePickersLoader";
import { NavScopePickersSkeleton } from "./NavScopePickersSkeleton";

function NotificationsFallback() {
  return (
    <div
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground"
      aria-hidden
    >
      <span className="h-4 w-4 animate-pulse rounded bg-muted" />
    </div>
  );
}

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
  return (
    <header className="sticky top-0 z-40 w-full max-w-[100vw] overflow-x-clip border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="relative z-50 mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center justify-between sm:gap-2 sm:px-6 lg:px-8">
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:contents">
          <Link
            href="/dashboard/overview"
            className="inline-flex min-w-0 shrink-0 items-center sm:order-1"
            aria-label="Telemetry Tracker"
          >
            <Logo compact />
          </Link>

          <DashboardTopNavActions
            className="relative z-[60] sm:order-3"
            user={user}
            commandPaletteEnabled={commandPaletteEnabled}
            notificationsSlot={
              <Suspense fallback={<NotificationsFallback />}>
                <DashboardNotificationsLoader />
              </Suspense>
            }
          />
        </div>

        <div className="min-w-0 w-full mr-auto overflow-x-auto overscroll-x-contain px-0 scrollbar-hide sm:order-2 sm:w-auto sm:overflow-visible">
          <Suspense fallback={<NavScopePickersSkeleton />}>
            <NavScopePickersLoader
              organizations={organizations}
              currentOrganizationId={currentOrganizationId}
              projects={projects}
              currentProjectId={currentProjectId}
              environments={environments}
              apps={apps}
            />
          </Suspense>
        </div>
      </div>
      <div className="relative z-10">
        <DashboardNavTabs />
      </div>
    </header>
  );
}
