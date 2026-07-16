"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type DashboardNavigationValue = {
  push: (href: string) => void;
  replace: (href: string) => void;
  /** Wrap async scope switches (org/project) so the overlay stays up through the server action. */
  runPending: (fn: () => Promise<void>) => Promise<void>;
  isPending: boolean;
};

const DashboardNavigationContext = createContext<DashboardNavigationValue | null>(null);

function DashboardNavigationOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/55 backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-background/40 motion-reduce:backdrop-blur-none motion-reduce:bg-background/80"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading…</span>
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground motion-reduce:animate-none motion-reduce:opacity-80"
        aria-hidden
      />
    </div>
  );
}

export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [transitionPending, startTransition] = useTransition();
  const [asyncPendingCount, setAsyncPendingCount] = useState(0);

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

  const runPending = useCallback(async (fn: () => Promise<void>) => {
    setAsyncPendingCount((n) => n + 1);
    try {
      await fn();
    } finally {
      setAsyncPendingCount((n) => Math.max(0, n - 1));
    }
  }, []);

  const isPending = transitionPending || asyncPendingCount > 0;

  const value = useMemo(
    () => ({ push, replace, runPending, isPending }),
    [push, replace, runPending, isPending]
  );

  return (
    <DashboardNavigationContext.Provider value={value}>
      {children}
      <DashboardNavigationOverlay active={isPending} />
    </DashboardNavigationContext.Provider>
  );
}

/** Shared dashboard router helpers + pending flag for the full-screen navigation overlay. */
export function useDashboardNavigation(): DashboardNavigationValue {
  const ctx = useContext(DashboardNavigationContext);
  if (!ctx) {
    throw new Error("useDashboardNavigation must be used within DashboardNavigationProvider");
  }
  return ctx;
}

/** Soft-navigate internal dashboard links so the full-screen overlay engages. */
export function useDashboardNavLinkProps(href: string): {
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  "aria-disabled"?: boolean;
} {
  const { push, isPending } = useDashboardNavigation();

  return {
    href,
    "aria-disabled": isPending || undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (!href.startsWith("/dashboard")) return;
      event.preventDefault();
      push(href);
    },
  };
}
