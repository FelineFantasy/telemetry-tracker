"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";

type DashboardNavigationValue = {
  push: (href: string) => void;
  replace: (href: string) => void;
  /** URL cleanup that must not show the full-screen overlay (e.g. invalid query sanitization). */
  replaceSilent: (href: string) => void;
  /**
   * Scope cookie change: replace URL and refresh RSC tree while keeping the overlay up.
   * Resolves when the shell reports a new org/project scope (RSC re-render), or on timeout.
   */
  replaceAndRefresh: (href: string) => Promise<void>;
  /** Wrap async scope switches (org/project) so the overlay stays up through the server action. */
  runPending: (fn: () => Promise<void>) => Promise<void>;
  /**
   * Call from the shell when server-rendered org/project ids update so
   * `replaceAndRefresh` can clear the overlay after RSC refresh, not on a timer.
   */
  markScopeRendered: () => void;
  isPending: boolean;
};

const DashboardNavigationContext = createContext<DashboardNavigationValue | null>(null);

function DashboardNavigationOverlay({ active }: { active: boolean }) {
  useBodyScrollLock(active);
  if (!active) return null;
  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-background/55 backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-background/40 motion-reduce:backdrop-blur-none motion-reduce:bg-background/80"
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

const REFRESH_MIN_HOLD_MS = 100;
const REFRESH_MAX_HOLD_MS = 10_000;

export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [transitionPending, startTransition] = useTransition();
  const [asyncPendingCount, setAsyncPendingCount] = useState(0);
  const scopeEpochRef = useRef(0);

  const markScopeRendered = useCallback(() => {
    scopeEpochRef.current += 1;
  }, []);

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

  const replaceSilent = useCallback(
    (href: string) => {
      router.replace(href);
    },
    [router]
  );

  const replaceAndRefresh = useCallback(
    (href: string) => {
      setAsyncPendingCount((n) => n + 1);
      const epochAtStart = scopeEpochRef.current;
      startTransition(() => {
        router.replace(href);
        router.refresh();
      });

      return new Promise<void>((resolve) => {
        const startedAt = performance.now();
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          setAsyncPendingCount((n) => Math.max(0, n - 1));
          resolve();
        };

        const tick = () => {
          const elapsed = performance.now() - startedAt;
          if (elapsed >= REFRESH_MAX_HOLD_MS) {
            finish();
            return;
          }
          // Wait for shell to report new org/project from RSC — not useTransition idle.
          if (
            elapsed >= REFRESH_MIN_HOLD_MS &&
            scopeEpochRef.current > epochAtStart
          ) {
            finish();
            return;
          }
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
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
    () => ({
      push,
      replace,
      replaceSilent,
      replaceAndRefresh,
      runPending,
      markScopeRendered,
      isPending,
    }),
    [
      push,
      replace,
      replaceSilent,
      replaceAndRefresh,
      runPending,
      markScopeRendered,
      isPending,
    ]
  );

  return (
    <DashboardNavigationContext.Provider value={value}>
      <div
        inert={isPending ? true : undefined}
        aria-hidden={isPending ? true : undefined}
        className={isPending ? "pointer-events-none" : undefined}
      >
        {children}
      </div>
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

/**
 * Bumps the navigation scope epoch when server-rendered org/project ids change,
 * so `replaceAndRefresh` can clear the overlay after RSC refresh.
 */
export function DashboardNavigationScopeAck({
  organizationId,
  projectId,
}: {
  organizationId: string | null;
  projectId: string;
}) {
  const { markScopeRendered } = useDashboardNavigation();

  useEffect(() => {
    markScopeRendered();
  }, [markScopeRendered, organizationId, projectId]);

  return null;
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
      if (isPending) {
        event.preventDefault();
        return;
      }
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
