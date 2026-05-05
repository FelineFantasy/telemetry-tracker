import type Stripe from "stripe";
import { PlanTier } from "@prisma/client";
import { stripeSubscriptionPeriodEndUnix } from "./stripe-runtime-fields.js";

export function parsePlanTierMetadata(raw: string | undefined): PlanTier | null {
  const u = raw?.trim().toUpperCase();
  if (u === "FREE" || u === "PRO" || u === "BUSINESS") return u;
  return null;
}

/**
 * Prefer subscription metadata, then first subscription item price metadata (Stripe Dashboard).
 */
export function parsePlanTierFromStripeSubscription(
  sub: Pick<Stripe.Subscription, "metadata" | "items">
): PlanTier | null {
  const fromSub = parsePlanTierMetadata(sub.metadata?.plan_tier);
  if (fromSub && fromSub !== PlanTier.FREE) return fromSub;
  const priceMeta = sub.items?.data?.[0]?.price?.metadata?.plan_tier;
  return parsePlanTierMetadata(priceMeta);
}

export type SubscriptionOrgSyncPatch = {
  stripe_subscription_status: string;
  stripe_current_period_end: Date | null;
  plan_tier?: PlanTier;
};

export function subscriptionToOrgSyncPatch(
  sub: Stripe.Subscription
): SubscriptionOrgSyncPatch {
  const tier = parsePlanTierFromStripeSubscription(sub);
  const periodEnd = stripeSubscriptionPeriodEndUnix(sub);
  const patch: SubscriptionOrgSyncPatch = {
    stripe_subscription_status: sub.status,
    stripe_current_period_end: periodEnd ? new Date(periodEnd * 1000) : null,
  };
  if (tier && tier !== PlanTier.FREE) {
    patch.plan_tier = tier;
  }
  return patch;
}
