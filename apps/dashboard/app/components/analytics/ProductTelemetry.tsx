"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { TelemetryProvider, useTrackPage } from "@telemetry-tracker/next";
import {
  getProductTelemetryConfig,
  shouldTrackProductTelemetry,
} from "@/lib/product-telemetry";

function TrackPage() {
  const pathname = usePathname();
  useTrackPage(pathname ?? "/");
  return null;
}

/**
 * Dogfoods @telemetry-tracker/next on `/dashboard/*` for visits, sessions, and browser errors
 * when env is set. Marketing/docs are not instrumented (use Google Analytics + consent instead).
 */
export function ProductTelemetry() {
  const pathname = usePathname();
  const config = useMemo(() => getProductTelemetryConfig(), []);
  const shouldTrack = Boolean(config && shouldTrackProductTelemetry(pathname));

  if (!shouldTrack || !config) return null;

  return (
    <TelemetryProvider config={config}>
      <TrackPage />
    </TelemetryProvider>
  );
}
