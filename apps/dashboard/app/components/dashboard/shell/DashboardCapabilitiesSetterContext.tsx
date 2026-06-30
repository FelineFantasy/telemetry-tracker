"use client";

import { createContext, useContext } from "react";
import type { DashboardSessionContext } from "@/lib/dashboard-capabilities";

export type SetDashboardCapabilities = (capabilities: DashboardSessionContext | null) => void;

export const DashboardCapabilitiesSetterContext = createContext<SetDashboardCapabilities | null>(
  null
);

export function useDashboardCapabilitiesSetter(): SetDashboardCapabilities {
  const setter = useContext(DashboardCapabilitiesSetterContext);
  if (!setter) {
    throw new Error("useDashboardCapabilitiesSetter must be used within DashboardShell");
  }
  return setter;
}
