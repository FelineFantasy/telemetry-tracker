"use client";

import type { ReactNode } from "react";
import { useDeferredAnalytics } from "@/lib/use-deferred-analytics";

function AnalyticsPanelsSkeleton() {
  return (
    <section
      className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading analytics…</span>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-surface motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-xl border border-border bg-surface motion-reduce:animate-none" />
    </section>
  );
}

/** Client-fetches analytics after paint; shows a compact skeleton while loading. */
export function DeferredAnalyticsSlot<T>({
  apiPath,
  queryString,
  children,
}: {
  apiPath: string;
  queryString: string;
  children: (data: T) => ReactNode;
}) {
  const { data, loading } = useDeferredAnalytics<T>(apiPath, queryString);

  if (loading) return <AnalyticsPanelsSkeleton />;
  if (!data) return null;
  return <>{children(data)}</>;
}
