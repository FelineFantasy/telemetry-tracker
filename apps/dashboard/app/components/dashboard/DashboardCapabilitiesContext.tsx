"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashboardSessionContext } from "@/lib/dashboard-capabilities";

const DashboardCapabilitiesContext = createContext<DashboardSessionContext | null>(null);

export function DashboardCapabilitiesProvider({
  value,
  children,
}: {
  value: DashboardSessionContext | null;
  children: ReactNode;
}) {
  return (
    <DashboardCapabilitiesContext.Provider value={value}>
      {children}
    </DashboardCapabilitiesContext.Provider>
  );
}

export function useDashboardCapabilities(): DashboardSessionContext | null {
  return useContext(DashboardCapabilitiesContext);
}
