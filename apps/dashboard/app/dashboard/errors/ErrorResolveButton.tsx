"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setErrorResolvedAction } from "@/app/dashboard/actions";
import { toast } from "sonner";
import { useDashboardCapabilities } from "@/app/components/dashboard/DashboardCapabilitiesContext";
import { Button } from "@/app/components/ui/Button";

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
    <Button
      type="button"
      variant={resolved ? "secondary" : "primary"}
      disabled={pending}
      onClick={onClick}
    >
      {pending ? "…" : resolved ? "Mark as open" : "Mark as resolved"}
    </Button>
  );
}
