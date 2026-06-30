"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  createBillingCheckoutAction,
  createBillingPortalAction,
} from "@/app/dashboard/actions";
import { SettingsBtn } from "@/app/components/dashboard/settings/settings-ui";

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
      <SettingsBtn
        type="button"
        variant="primary"
        disabled={pending}
        onClick={() => goCheckout("PRO")}
      >
        Upgrade to Pro
      </SettingsBtn>
      <SettingsBtn
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => goCheckout("BUSINESS")}
      >
        Upgrade to Business
      </SettingsBtn>
      {hasStripeCustomer ? (
        <SettingsBtn type="button" variant="outline" disabled={pending} onClick={goPortal}>
          Manage billing
        </SettingsBtn>
      ) : null}
    </div>
  );
}
