"use client";

import {
  SessionsAnalyticsPanels,
  type SessionsAnalyticsData,
} from "@/app/components/dashboard/SessionsAnalyticsPanels";
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

export function DeferredSessionsAnalytics({
  queryString,
  path,
  currentParams,
}: {
  queryString: string;
  path: string;
  currentParams: Record<string, string>;
}) {
  const { data, loading } = useDeferredAnalytics<SessionsAnalyticsData>(
    "/api/sessions/analytics",
    queryString
  );

  if (loading) return <AnalyticsPanelsSkeleton />;
  if (!data) return null;
  return (
    <SessionsAnalyticsPanels
      analytics={data}
      path={path}
      currentParams={currentParams}
    />
  );
}
