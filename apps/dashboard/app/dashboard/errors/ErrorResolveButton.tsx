"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { API_BASE_URL } from "@/lib/api-url";

export function ErrorResolveButton({
  errorGroupId,
  resolved,
  projectId,
}: {
  errorGroupId: string;
  resolved: boolean;
  projectId: string;
}) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/errors/${errorGroupId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Project-Id": projectId,
        },
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
