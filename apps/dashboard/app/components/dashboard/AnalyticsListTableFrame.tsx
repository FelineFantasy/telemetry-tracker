"use client";

import type { ReactNode } from "react";

export function AnalyticsListTableFrame({
  isLoading,
  refreshError,
  children,
}: {
  isLoading: boolean;
  /** Shown above the table when a refetch fails but stale rows are still visible. */
  refreshError?: unknown;
  children: ReactNode;
}) {
  const refreshErrorMessage =
    refreshError instanceof Error ? refreshError.message : refreshError ? String(refreshError) : null;

  return (
    <div className="relative">
      {isLoading ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-16 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading table…</span>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      ) : null}
      {refreshErrorMessage ? (
        <div
          className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-foreground">Could not refresh table</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing the last loaded results. {refreshErrorMessage}
          </p>
        </div>
      ) : null}
      <div className={isLoading ? "pointer-events-none opacity-60" : undefined}>
        {children}
      </div>
    </div>
  );
}
