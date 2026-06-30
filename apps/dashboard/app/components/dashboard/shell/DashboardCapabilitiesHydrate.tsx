"use client";

import { useLayoutEffect } from "react";
import type { DashboardSessionContext } from "@/lib/dashboard-capabilities";
import { useDashboardCapabilitiesSetter } from "./DashboardCapabilitiesSetterContext";

export function DashboardCapabilitiesHydrate({
  capabilities,
}: {
  capabilities: DashboardSessionContext | null;
}) {
  const setCapabilities = useDashboardCapabilitiesSetter();

  useLayoutEffect(() => {
    setCapabilities(capabilities);
  }, [capabilities, setCapabilities]);

  return null;
}
