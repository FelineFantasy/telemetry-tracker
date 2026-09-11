import type { ReactNode } from "react";

export function OverviewGreeting({
  actions,
}: {
  user?: unknown;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Monitor and improve your applications.
        </p>
      </div>
      {actions ? (
        <div className="relative z-20 flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
