import { currentYearMonth } from "./usage-meter.js";

function billingPeriodScope(
  stripeCurrentPeriodEnd: Date | string | null | undefined
): string {
  if (stripeCurrentPeriodEnd == null) {
    return currentYearMonth();
  }
  const iso =
    stripeCurrentPeriodEnd instanceof Date
      ? stripeCurrentPeriodEnd.toISOString()
      : String(stripeCurrentPeriodEnd);
  return iso.slice(0, 10);
}

/** Scoped billing alert key — one per org, variant, and billing period (in-app read + email dedupe). */
export function billingNotificationKey(
  organizationId: string,
  variant: string,
  stripeCurrentPeriodEnd?: Date | string | null
): string {
  return `billing:${variant}:${organizationId}:${billingPeriodScope(stripeCurrentPeriodEnd)}`;
}

export const billingNotificationEmailKey = billingNotificationKey;
