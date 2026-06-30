export type BillingAlertVariant =
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";

/**
 * Dashboard banner when Stripe subscription needs attention (still on paid tier for past_due).
 * Matches statuses that downgrade limits in `effectivePlanTierForLimits` except past_due.
 */
export function billingAlertVariant(
  status: string | null | undefined
): BillingAlertVariant | null {
  if (status == null || status === "") return null;
  const s = status.toLowerCase();
  if (s === "past_due") return "past_due";
  if (s === "unpaid") return "unpaid";
  if (s === "canceled") return "canceled";
  if (s === "incomplete") return "incomplete";
  if (s === "incomplete_expired") return "incomplete_expired";
  return null;
}

export type BillingHealthSnapshot = {
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEnd: string | null;
  storedPlanTier: string;
  effectivePlanTier: string;
  hasStripeCustomer: boolean;
  billingAlertVariant: BillingAlertVariant | null;
};

export function billingHealthFromPlanContext(ctx: {
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEnd: Date | null;
  storedPlanTier: string;
  planTier: string;
  stripeCustomerId: string | null;
}): BillingHealthSnapshot {
  return {
    stripeSubscriptionStatus: ctx.stripeSubscriptionStatus,
    stripeCurrentPeriodEnd: ctx.stripeCurrentPeriodEnd
      ? ctx.stripeCurrentPeriodEnd.toISOString()
      : null,
    storedPlanTier: ctx.storedPlanTier,
    effectivePlanTier: ctx.planTier,
    hasStripeCustomer: ctx.stripeCustomerId != null,
    billingAlertVariant: billingAlertVariant(ctx.stripeSubscriptionStatus),
  };
}
