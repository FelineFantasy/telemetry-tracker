import type { TelemetryConfig } from "@telemetry-tracker/core";
import { isMarketingAnalyticsPath } from "@/lib/google-analytics";

export const DEFAULT_PRODUCT_TELEMETRY_APP = "telemetry-tracker-dashboard";

/** Client config for dogfooding Telemetry Tracker on the dashboard. No-op when unset. */
export function getProductTelemetryConfig(): TelemetryConfig | null {
  if (process.env.NODE_ENV === "test") return null;

  const ingestUrl = process.env.NEXT_PUBLIC_TELEMETRY_INGEST_URL?.trim();
  const apiKey = process.env.NEXT_PUBLIC_TELEMETRY_API_KEY?.trim();
  if (!ingestUrl || !apiKey) return null;

  const app =
    process.env.NEXT_PUBLIC_TELEMETRY_APP?.trim() || DEFAULT_PRODUCT_TELEMETRY_APP;

  return {
    ingestUrl: ingestUrl.replace(/\/$/, ""),
    apiKey,
    app,
    environment: process.env.NODE_ENV ?? "development",
  };
}

export function isProductTelemetryEnabled(): boolean {
  return getProductTelemetryConfig() !== null;
}

/**
 * Product pages always track when configured; marketing/docs require cookie consent
 * (same split as Google Analytics).
 */
export function shouldTrackProductTelemetry(
  pathname: string | null | undefined,
  consentAccepted: boolean
): boolean {
  if (!isProductTelemetryEnabled()) return false;
  if (!isMarketingAnalyticsPath(pathname)) return true;
  return consentAccepted;
}
