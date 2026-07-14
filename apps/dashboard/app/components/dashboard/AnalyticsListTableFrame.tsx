"use client";

import type { ReactNode } from "react";

export function AnalyticsListTableFrame({
  isLoading,
  children,
}: {
  isLoading: boolean;
  children: ReactNode;
}) {
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
      <div className={isLoading ? "pointer-events-none opacity-60" : undefined}>
        {children}
      </div>
    </div>
  );
}
