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
import { TopNavOrgSwitcher } from "./TopNavOrgSwitcher";
import { TopNavProjectSwitcher } from "./TopNavProjectSwitcher";

export function DashboardTopNav({
  organizations,
  currentOrganizationId,
  projects,
  currentProjectId,
  user,
  environments,
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
  projects: ProjectOption[];
  currentProjectId: string;
  user: DashboardUser | null;
  environments: string[];
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/overview"
          className="inline-flex shrink-0 items-center"
          aria-label="Telemetry Tracker"
        >
          <Logo />
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <Suspense fallback={null}>
            <TopNavOrgSwitcher
              organizations={organizations}
              currentOrganizationId={currentOrganizationId}
            />
          </Suspense>
          <Suspense fallback={null}>
            <TopNavProjectSwitcher projects={projects} currentProjectId={currentProjectId} />
          </Suspense>
          <Suspense fallback={null}>
            <DashboardEnvSelector environments={environments} />
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
      <DashboardNavTabs />
    </header>
  );
}
