"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FiltersSortPanel({
  rangeSummary,
  children,
}: {
  rangeSummary: string | null;
  children: ReactNode;
}) {
  const panelId = useId();
  const bodyId = `${panelId}-body`;
  const [mobileOpen, setMobileOpen] = useState(false);

  const rangeChip = rangeSummary ? (
    <span
      className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
      title="Custom date range"
    >
      {rangeSummary}
    </span>
  ) : null;

  return (
    <section
      className="mb-6 overflow-visible rounded-xl border border-border bg-surface/40"
      aria-label="Filters and sort"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-border px-4 py-3 sm:hidden"
        aria-expanded={mobileOpen}
        aria-controls={bodyId}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="text-sm font-medium">Filters &amp; sort</span>
        <span className="flex items-center gap-2">
          {rangeChip}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              mobileOpen && "rotate-180"
            )}
          />
        </span>
      </button>

      <div className="hidden flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:flex">
        <h2 className="text-sm font-medium">Filters &amp; sort</h2>
        {rangeChip}
      </div>

      <div id={bodyId} className={cn("p-4", !mobileOpen && "hidden sm:block")}>
        {children}
      </div>
    </section>
  );
}
