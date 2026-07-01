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

/** Scoped dedupe key for billing alert emails — one per org, variant, and billing period. */
export function billingNotificationEmailKey(
  organizationId: string,
  variant: string,
  stripeCurrentPeriodEnd?: Date | string | null
): string {
  return `billing:${variant}:${organizationId}:${billingPeriodScope(stripeCurrentPeriodEnd)}`;
}
