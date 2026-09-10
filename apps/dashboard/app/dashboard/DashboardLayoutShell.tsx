import { Suspense } from "react";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { DashboardCapabilitiesLoader } from "@/app/components/dashboard/shell/DashboardCapabilitiesLoader";
import { DashboardCapabilitiesRoot } from "@/app/components/dashboard/shell/DashboardCapabilitiesRoot";
import { DashboardTopNavFallback } from "@/app/components/dashboard/shell/DashboardTopNavFallback";
import { DashboardTopNavLoader } from "@/app/components/dashboard/shell/DashboardTopNavLoader";
import { DashboardNavigationProvider } from "@/lib/use-dashboard-navigation";

export function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardNavigationProvider>
      <DashboardCapabilitiesRoot
        loader={
          <Suspense fallback={null}>
            <DashboardCapabilitiesLoader />
          </Suspense>
        }
      >
        <div className="min-h-screen w-full overflow-x-clip bg-background text-foreground">
          <Suspense fallback={<DashboardTopNavFallback />}>
            <DashboardTopNavLoader />
          </Suspense>
          <DashboardShell>{children}</DashboardShell>
        </div>
      </DashboardCapabilitiesRoot>
    </DashboardNavigationProvider>
  );
}
