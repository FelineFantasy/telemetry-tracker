"use client";

import { useState, type ReactNode } from "react";
import type { DashboardSessionContext } from "@/lib/dashboard-capabilities";
import { DashboardCapabilitiesProvider } from "@/app/components/dashboard/DashboardCapabilitiesContext";
import { DashboardCapabilitiesSetterContext } from "./DashboardCapabilitiesSetterContext";

export function DashboardCapabilitiesRoot({
  loader,
  children,
}: {
  loader: ReactNode;
  children: ReactNode;
}) {
  const [capabilities, setCapabilities] = useState<DashboardSessionContext | null>(null);

  return (
    <DashboardCapabilitiesSetterContext.Provider value={setCapabilities}>
      {loader}
      <DashboardCapabilitiesProvider value={capabilities}>
        {children}
      </DashboardCapabilitiesProvider>
    </DashboardCapabilitiesSetterContext.Provider>
  );
}
