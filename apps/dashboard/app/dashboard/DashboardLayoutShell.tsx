import { Suspense } from "react";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { DashboardCapabilitiesLoader } from "@/app/components/dashboard/shell/DashboardCapabilitiesLoader";
import { DashboardTopNavFallback } from "@/app/components/dashboard/shell/DashboardTopNavFallback";
import { DashboardTopNavLoader } from "@/app/components/dashboard/shell/DashboardTopNavLoader";

export function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
  );
}
