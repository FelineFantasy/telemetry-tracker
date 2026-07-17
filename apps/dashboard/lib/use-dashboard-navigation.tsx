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

export type DashboardNavigationScope = {
  organizationId: string | null;
  projectId: string;
};

type DashboardNavigationValue = {
  push: (href: string) => void;
  replace: (href: string) => void;
  /** URL cleanup that must not show the full-screen overlay (e.g. invalid query sanitization). */
  replaceSilent: (href: string) => void;
  /**
   * Scope cookie change: replace URL and refresh RSC tree while keeping the overlay up.
   * Pass the expected post-switch scope so we can wait for the shell ack (or hold through
   * refresh when `revalidatePath` already updated the nav).
   */
  replaceAndRefresh: (
    href: string,
    expect: DashboardNavigationScope
  ) => Promise<void>;
  /** Wrap async scope switches (org/project) so the overlay stays up through the server action. */
  runPending: (fn: () => Promise<void>) => Promise<void>;
  /** Report server-rendered org/project ids after they change. */
  markScopeRendered: (scope: DashboardNavigationScope) => void;
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

/** Nav already matches via revalidatePath — hold long enough for page RSC refresh. */
const REFRESH_ALREADY_MATCHED_HOLD_MS = 800;
const REFRESH_ALREADY_MATCHED_AFTER_TRANSITION_MS = 400;
const REFRESH_MAX_HOLD_MS = 10_000;

function scopesMatch(
  rendered: DashboardNavigationScope | null,
  expect: DashboardNavigationScope
): boolean {
  if (!rendered) return false;
  if (rendered.organizationId !== expect.organizationId) return false;
  // Org switches may land on a different default project; only require project when set.
  if (expect.projectId && rendered.projectId !== expect.projectId) return false;
  return true;
}

export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [transitionPending, startTransition] = useTransition();
  const [asyncPendingCount, setAsyncPendingCount] = useState(0);
  const transitionPendingRef = useRef(false);
  const renderedScopeRef = useRef<DashboardNavigationScope | null>(null);
  const scopeSignalRef = useRef(0);

  useEffect(() => {
    transitionPendingRef.current = transitionPending;
  }, [transitionPending]);

  const markScopeRendered = useCallback((scope: DashboardNavigationScope) => {
    const prev = renderedScopeRef.current;
    if (
      prev &&
      prev.organizationId === scope.organizationId &&
      prev.projectId === scope.projectId
    ) {
      // Remounts of the top nav must not advance the settle signal with the same scope.
      return;
    }
    renderedScopeRef.current = scope;
    scopeSignalRef.current += 1;
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
    (href: string, expect: DashboardNavigationScope) => {
      setAsyncPendingCount((n) => n + 1);
      const signalAtStart = scopeSignalRef.current;
      const alreadyMatches = scopesMatch(renderedScopeRef.current, expect);

      startTransition(() => {
        router.replace(href);
        router.refresh();
      });

      return new Promise<void>((resolve) => {
        const startedAt = performance.now();
        let settled = false;
        let sawTransition = false;
        let scopeMatchedAt: number | null = null;

        const finish = () => {
          if (settled) return;
          settled = true;
          setAsyncPendingCount((n) => Math.max(0, n - 1));
          resolve();
        };

        const tick = () => {
          if (transitionPendingRef.current) sawTransition = true;
          const elapsed = performance.now() - startedAt;
          if (elapsed >= REFRESH_MAX_HOLD_MS) {
            finish();
            return;
          }

          if (alreadyMatches) {
            // Shell already shows the new scope (server action revalidatePath).
            // Hold through router.refresh() via transition idle + floor.
            const floor = sawTransition
              ? REFRESH_ALREADY_MATCHED_AFTER_TRANSITION_MS
              : REFRESH_ALREADY_MATCHED_HOLD_MS;
            if (elapsed >= floor && !transitionPendingRef.current) {
              finish();
              return;
            }
          } else {
            const advanced = scopeSignalRef.current > signalAtStart;
            if (advanced && scopesMatch(renderedScopeRef.current, expect)) {
              if (scopeMatchedAt === null) scopeMatchedAt = performance.now();
              // Nav scope updated, but page RSC may still be refreshing — wait for
              // transition idle plus a post-ack floor (refresh often never stays pending).
              const sinceMatch = performance.now() - scopeMatchedAt;
              const floor = sawTransition
                ? REFRESH_ALREADY_MATCHED_AFTER_TRANSITION_MS
                : REFRESH_ALREADY_MATCHED_HOLD_MS;
              if (sinceMatch >= floor && !transitionPendingRef.current) {
                finish();
                return;
              }
            }
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
 * Reports org/project scope when server-rendered ids change (not on every remount).
 */
export function DashboardNavigationScopeAck({
  organizationId,
  projectId,
}: {
  organizationId: string | null;
  projectId: string;
}) {
  const { markScopeRendered } = useDashboardNavigation();
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${organizationId ?? ""}:${projectId}`;
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    markScopeRendered({ organizationId, projectId });
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
