/**
 * Public list prices (EUR) for marketing and dashboard copy.
 * Stripe Price objects must use the same currency in the Stripe Dashboard.
 */
export const PLAN_LIST_PRICES_EUR = {
  FREE: 0,
  PRO: 29,
  BUSINESS: 99,
} as const;

export type PaidPlanTier = keyof typeof PLAN_LIST_PRICES_EUR;

export function formatPlanPriceEur(amount: number): string {
  if (amount === 0) return "€0";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function billingStatusLabel(
  billing: {
    stripeSubscriptionStatus: string | null;
    billingAlertVariant: string | null;
    effectivePlanTier: string;
  } | null
): string {
  if (!billing) return "Unknown";
  const v = billing.billingAlertVariant;
  if (v === "past_due") return "Past due";
  if (v === "unpaid") return "Unpaid";
  if (v === "canceled") return "Canceled";
  if (v === "incomplete") return "Incomplete";
  if (v === "incomplete_expired") return "Setup expired";
  const status = billing.stripeSubscriptionStatus?.toLowerCase();
  if (status === "active" || status === "trialing") return "Active";
  if (status) return billing.stripeSubscriptionStatus!;
  return billing.effectivePlanTier === "FREE" ? "Free tier" : billing.effectivePlanTier;
}

export function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return null;
  }
}
