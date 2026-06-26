"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  createBillingCheckoutAction,
  createBillingPortalAction,
} from "@/app/dashboard/actions";
import { Button } from "@/app/components/ui/Button";

export function OrganizationBillingActions({
  organizationId,
  canManageBilling,
  hasStripeCustomer,
}: {
  organizationId: string;
  canManageBilling: boolean;
  hasStripeCustomer: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (!canManageBilling) return null;

  function goCheckout(tier: "PRO" | "BUSINESS") {
    startTransition(async () => {
      const r = await createBillingCheckoutAction(organizationId, tier);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      window.location.href = r.url;
    });
  }

  function goPortal() {
    startTransition(async () => {
      const r = await createBillingPortalAction(organizationId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      window.location.href = r.url;
    });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        type="button"
        variant="primary"
        disabled={pending}
        onClick={() => goCheckout("PRO")}
      >
        Upgrade to Pro
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => goCheckout("BUSINESS")}
      >
        Upgrade to Business
      </Button>
      {hasStripeCustomer ? (
        <Button type="button" variant="secondary" disabled={pending} onClick={goPortal}>
          Manage billing
        </Button>
      ) : null}
    </div>
  );
}
