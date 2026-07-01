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
  organizationId: string;
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEnd: string | null;
  storedPlanTier: string;
  effectivePlanTier: string;
  hasStripeCustomer: boolean;
  billingAlertVariant: BillingAlertVariant | null;
};

export function billingAlertNotificationContent(
  variant: BillingAlertVariant,
  storedPlanTier: string,
  effectivePlanTier: string
): { title: string; body: string } {
  switch (variant) {
    case "past_due":
      return {
        title: "Payment past due",
        body: `Update your payment method in Stripe. Your ${storedPlanTier} limits still apply until the subscription updates.`,
      };
    case "unpaid":
      return {
        title: "Subscription unpaid",
        body: `Effective tier is ${effectivePlanTier}. Update billing to restore paid limits.`,
      };
    case "canceled":
      return {
        title: "Subscription canceled",
        body: `Entitlements follow the ${effectivePlanTier} tier.`,
      };
    case "incomplete":
      return {
        title: "Subscription incomplete",
        body: `Entitlements use the ${effectivePlanTier} tier until payment completes.`,
      };
    case "incomplete_expired":
      return {
        title: "Subscription setup expired",
        body: `Entitlements use the ${effectivePlanTier} tier until you subscribe again.`,
      };
  }
}

export function billingHealthFromPlanContext(ctx: {
  organizationId: string;
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEnd: Date | null;
  storedPlanTier: string;
  planTier: string;
  stripeCustomerId: string | null;
}): BillingHealthSnapshot {
  return {
    organizationId: ctx.organizationId,
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
