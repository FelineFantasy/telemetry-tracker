"use client";

import { useId, type ReactNode } from "react";

export function FiltersSortPanel({
  rangeSummary,
  children,
}: {
  rangeSummary: string | null;
  children: ReactNode;
}) {
  const panelId = useId();
  return (
    <div
      className="mb-6 overflow-visible rounded-xl border border-border bg-surface/40"
      aria-labelledby={panelId}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id={panelId} className="text-sm font-medium">
          Filters &amp; sort
        </h2>
        {rangeSummary ? (
          <span
            className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            title="Custom date range"
          >
            {rangeSummary}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
