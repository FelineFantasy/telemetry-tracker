"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";
import { DashboardNavigationScopeAck } from "@/lib/use-dashboard-navigation";
import type { DashboardUser } from "@/lib/dashboard-user";
import { DashboardMobileMenuButton, DashboardSidebar } from "./DashboardSidebar";
import { DashboardTopNavActions } from "./DashboardTopNavActions";
import { DashboardNotificationsLoader } from "./DashboardNotificationsLoader";

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

export function DashboardChrome({
  currentOrganizationId,
  currentProjectId,
  user,
  commandPaletteEnabled,
  sidebarWorkspace,
  headerScope,
}: {
  currentOrganizationId: string | null;
  currentProjectId: string;
  user: DashboardUser | null;
  commandPaletteEnabled: boolean;
  sidebarWorkspace: ReactNode;
  headerScope: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useBodyScrollLock(mobileOpen);

  return (
    <>
      <DashboardSidebar
        user={user}
        workspaceSlot={sidebarWorkspace}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <header className="sticky top-0 z-40 w-full max-w-[100vw] overflow-x-clip border-b border-border/70 bg-background/85 backdrop-blur-xl lg:pl-60">
        <DashboardNavigationScopeAck
          organizationId={currentOrganizationId}
          projectId={currentProjectId}
        />
        <div className="flex h-12 items-center gap-2 px-3 sm:px-6">
          <DashboardMobileMenuButton onClick={() => setMobileOpen(true)} />
          <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain scrollbar-hide">
            {headerScope}
          </div>
          <DashboardTopNavActions
            className="relative z-[60]"
            user={user}
            commandPaletteEnabled={commandPaletteEnabled}
            showUserMenu={false}
            notificationsSlot={
              <Suspense fallback={<NotificationsFallback />}>
                <DashboardNotificationsLoader />
              </Suspense>
            }
          />
        </div>
      </header>
    </>
  );
}
