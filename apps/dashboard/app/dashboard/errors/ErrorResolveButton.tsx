"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";

export function ErrorResolveButton({
  errorGroupId,
  resolved,
  apiBase,
}: {
  errorGroupId: string;
  resolved: boolean;
  apiBase: string;
}) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const res = await fetch(`${apiBase}/api/errors/${errorGroupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !resolved }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      window.location.reload();
    } catch {
      setPending(false);
      alert("Could not update resolution status.");
    }
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
