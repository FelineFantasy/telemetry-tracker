"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setErrorResolvedAction } from "@/app/dashboard/actions";
import { toast } from "sonner";
import { useDashboardCapabilities } from "@/app/components/dashboard/DashboardCapabilitiesContext";
import { SettingsBtn } from "@/app/components/dashboard/settings/settings-ui";

export function ErrorResolveButton({
  errorGroupId,
  resolved,
}: {
  errorGroupId: string;
  resolved: boolean;
}) {
  const caps = useDashboardCapabilities();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!caps?.canResolveErrors) {
    return null;
  }

  function onClick() {
    startTransition(async () => {
      const res = await setErrorResolvedAction(errorGroupId, !resolved);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <SettingsBtn
      type="button"
      variant={resolved ? "default" : "primary"}
      disabled={pending}
      onClick={onClick}
    >
      {pending ? "…" : resolved ? "Mark as open" : "Mark as resolved"}
    </SettingsBtn>
  );
}
