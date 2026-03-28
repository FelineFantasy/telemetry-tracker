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
    <div className="errors-filters" aria-labelledby={panelId}>
      <div className="errors-filters__header">
        <h2 id={panelId} className="errors-filters__title">
          Filters &amp; sort
        </h2>
        {rangeSummary ? (
          <span className="errors-filters__range-badge" title="Custom date range">
            {rangeSummary}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
