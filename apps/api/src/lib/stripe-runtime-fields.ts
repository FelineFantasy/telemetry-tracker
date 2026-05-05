/**
 * stripe-node v22 typings lag runtime JSON for some fields. Use these accessors
 * so webhooks stay typed without @ts-expect-error scattered in handlers.
 */

export function stripeSubscriptionPeriodEndUnix(sub: unknown): number | null {
  if (typeof sub !== "object" || sub === null) return null;
  const n = (sub as { current_period_end?: unknown }).current_period_end;
  return typeof n === "number" ? n : null;
}
