"use client";

import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { Logo } from "@/app/components/marketing/logo";
import type { OrgOption } from "@/lib/dashboard-workspace-types";
import type { ProjectOption } from "@/lib/dashboard-workspace-types";
import type { DashboardUser } from "@/lib/dashboard-user";
import { DashboardNavTabs } from "./DashboardNavTabs";
import { DashboardNotifications } from "./DashboardNotifications";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardCommandPalette } from "./DashboardCommandPalette";
import { DashboardUserMenu } from "./DashboardUserMenu";
import { DashboardEnvSelector } from "./DashboardEnvSelector";
import { TopNavAppSwitcher } from "./TopNavAppSwitcher";
import { TopNavOrgSwitcher } from "./TopNavOrgSwitcher";
import { TopNavProjectSwitcher } from "./TopNavProjectSwitcher";

function NavScopePickers({
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
  return (
    <>
      <TopNavOrgSwitcher
        organizations={organizations}
        currentOrganizationId={currentOrganizationId}
      />
      <TopNavProjectSwitcher
        projects={projects}
        currentProjectId={currentProjectId}
        organizationId={currentOrganizationId}
      />
      <TopNavAppSwitcher apps={apps} />
      <DashboardEnvSelector environments={environments} />
    </>
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
          <Suspense
            fallback={
              <div className="h-9 w-48 animate-pulse rounded-md border border-border bg-surface/40" />
            }
          >
            <NavScopePickers
              organizations={organizations}
              currentOrganizationId={currentOrganizationId}
              projects={projects}
              currentProjectId={currentProjectId}
              environments={environments}
              apps={apps}
            />
          </Suspense>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <DashboardCommandPalette />
          <DashboardQuickActions />
          <DashboardNotifications />
          <Link
            href="/docs"
            aria-label="Documentation"
            className="hidden h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-surface/60 hover:text-foreground sm:grid"
          >
            <BookOpen className="h-4 w-4" />
          </Link>
          <DashboardUserMenu user={user} />
        </div>
      </div>
      <div className="relative z-10">
        <DashboardNavTabs />
      </div>
    </header>
  );
}
