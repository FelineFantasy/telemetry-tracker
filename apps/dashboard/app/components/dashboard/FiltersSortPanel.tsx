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
    <section className="mb-4" aria-label="Filters and sort">
      <div className="mb-2 flex items-center justify-between gap-2 sm:hidden">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium"
          aria-expanded={mobileOpen}
          aria-controls={bodyId}
          onClick={() => setMobileOpen((open) => !open)}
        >
          Filters
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              mobileOpen && "rotate-180"
            )}
          />
        </button>
        {rangeChip}
      </div>

      {rangeChip ? (
        <div className="mb-2 hidden sm:flex sm:justify-end">{rangeChip}</div>
      ) : null}

      <div id={bodyId} className={cn(!mobileOpen && "hidden sm:block")}>
        {children}
      </div>
    </section>
  );
}
