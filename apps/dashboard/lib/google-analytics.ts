import { resolveMetadataBase } from "@/lib/site-url";

/** Official hosted-cloud measurement id when env is unset. Self-hosted deployments omit GA unless configured. */
export const HOSTED_CLOUD_GA_ID = "G-VL5GTNNCHH";

const HOSTED_CLOUD_HOST = "telemetry-tracker.com";

/**
 * Resolve GA4 measurement id on the server (root layout). Uses runtime env such as
 * `RAILWAY_PUBLIC_DOMAIN` via `resolveMetadataBase()` — do not call from client components.
 */
export function getGoogleAnalyticsMeasurementId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV !== "production") return null;

  const hostname = resolveMetadataBase()?.hostname;
  if (hostname === HOSTED_CLOUD_HOST) return HOSTED_CLOUD_GA_ID;
  return null;
}

/** Marketing and public docs routes only — not authenticated dashboard product pages. */
export function isMarketingAnalyticsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !pathname.startsWith("/dashboard");
}
