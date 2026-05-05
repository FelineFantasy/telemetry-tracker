/**
 * stripe-node v22 typings lag runtime JSON for some fields. Use these accessors
 * so webhooks stay typed without @ts-expect-error scattered in handlers.
 */

export function stripeSubscriptionPeriodEndUnix(sub: unknown): number | null {
  if (typeof sub !== "object" || sub === null) return null;
  const n = (sub as { current_period_end?: unknown }).current_period_end;
  return typeof n === "number" ? n : null;
}

export function stripeInvoiceSubscriptionId(inv: unknown): string | null {
  if (typeof inv !== "object" || inv === null) return null;
  const sub = (inv as { subscription?: unknown }).subscription;
  if (typeof sub === "string") return sub;
  if (
    typeof sub === "object" &&
    sub !== null &&
    "id" in sub &&
    typeof (sub as { id: unknown }).id === "string"
  ) {
    return (sub as { id: string }).id;
  }
  return null;
}
