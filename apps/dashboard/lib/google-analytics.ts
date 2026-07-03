/** Official hosted-cloud measurement id when env is unset. Self-hosted deployments omit GA unless configured. */
const HOSTED_CLOUD_GA_ID = "G-VL5GTNNCHH";

/** Google Analytics 4 measurement id, or null when analytics should not load. */
export function getGoogleAnalyticsMeasurementId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV !== "production") return null;

  const siteHint = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.VERCEL_URL,
  ]
    .filter(Boolean)
    .join(" ");

  if (siteHint.includes("telemetry-tracker.com")) return HOSTED_CLOUD_GA_ID;
  return null;
}
