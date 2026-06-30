"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createBillingPortalAction } from "@/app/dashboard/actions";
import { SettingsBtn } from "@/app/components/dashboard/settings/settings-ui";

export function BillingPortalButton({
  organizationId,
  label = "Manage billing",
  variant = "primary",
}: {
  organizationId: string;
  label?: string;
  variant?: "primary" | "outline";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <SettingsBtn
      type="button"
      variant={variant}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await createBillingPortalAction(organizationId);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          window.location.href = r.url;
        });
      }}
    >
      {label}
    </SettingsBtn>
  );
}
