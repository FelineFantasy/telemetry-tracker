import { PlanTier } from "@prisma/client";

/**
 * Stripe statuses that revoke paid limits (see billing plan: keep past_due on stored tier with UI warning).
 */
const LIMITS_DOWNGRADE_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
  "incomplete",
]);

/**
 * Single source of truth for ingest and plan caps: stored `plan_tier` unless Stripe says the subscription
 * is no longer entitled to paid limits.
 */
export function effectivePlanTierForLimits(
  storedTier: PlanTier,
  stripeSubscriptionStatus: string | null | undefined
): PlanTier {
  if (stripeSubscriptionStatus == null || stripeSubscriptionStatus === "") {
    return storedTier;
  }
  if (LIMITS_DOWNGRADE_STATUSES.has(stripeSubscriptionStatus.toLowerCase())) {
    return PlanTier.FREE;
  }
  return storedTier;
}
