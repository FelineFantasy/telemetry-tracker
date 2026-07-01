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
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
  projects: ProjectOption[];
  currentProjectId: string;
  user: DashboardUser | null;
  environments: string[];
  apps: string[];
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="relative z-50 mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/overview"
          className="inline-flex shrink-0 items-center"
          aria-label="Telemetry Tracker"
        >
          <Logo />
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-visible">
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

        <DashboardTopNavActions
          user={user}
          notificationsSlot={
            <Suspense fallback={<NotificationsFallback />}>
              <DashboardNotificationsLoader />
            </Suspense>
          }
        />
      </div>
      <div className="relative z-10">
        <DashboardNavTabs />
      </div>
    </header>
  );
}
