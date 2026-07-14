"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { DashboardPopover } from "@/app/components/dashboard/shell/DashboardPopover";

export function MetricHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DashboardPopover
      width="w-72 max-w-[calc(100vw-2rem)]"
      align="right"
      trigger={(toggle, isOpen) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-label={`About ${label}`}
          title={`About ${label}`}
          className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    >
      {() => (
        <div className="px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{label}</p>
          {children}
        </div>
      )}
    </DashboardPopover>
  );
}
