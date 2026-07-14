"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Router navigation with a pending flag for scope/filter pickers. */
export function useDashboardNavigation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  const replace = useCallback(
    (href: string) => {
      startTransition(() => {
        router.replace(href);
      });
    },
    [router]
  );

  return { push, replace, isPending };
}
