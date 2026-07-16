import { Suspense } from "react";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { DashboardCapabilitiesLoader } from "@/app/components/dashboard/shell/DashboardCapabilitiesLoader";
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
      <div className="min-h-screen w-full overflow-x-clip bg-background text-foreground">
        <Suspense fallback={<DashboardTopNavFallback />}>
          <DashboardTopNavLoader />
        </Suspense>
        <DashboardShell
          capabilitiesLoader={
            <Suspense fallback={null}>
              <DashboardCapabilitiesLoader />
            </Suspense>
          }
        >
          {children}
        </DashboardShell>
      </div>
    </DashboardNavigationProvider>
  );
}
