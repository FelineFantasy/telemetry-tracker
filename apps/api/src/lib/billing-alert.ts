export type BillingAlertVariant = "past_due" | "unpaid" | "canceled";

/**
 * Dashboard banner when Stripe subscription needs attention (still on paid tier for past_due).
 */
export function billingAlertVariant(
  status: string | null | undefined
): BillingAlertVariant | null {
  if (status == null || status === "") return null;
  const s = status.toLowerCase();
  if (s === "past_due") return "past_due";
  if (s === "unpaid") return "unpaid";
  if (s === "canceled") return "canceled";
  return null;
}
