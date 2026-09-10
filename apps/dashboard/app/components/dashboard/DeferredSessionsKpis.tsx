"use client";

import {
  SessionsSummaryMetrics,
  type SessionsPageSummary,
} from "@/app/components/dashboard/SessionsSummaryMetrics";
import { SessionsUserCohortMetrics } from "@/app/components/dashboard/SessionsUserCohortMetrics";
import { useDeferredAnalytics } from "@/lib/use-deferred-analytics";

function SessionsKpisSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading session metrics…</span>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border bg-surface/30 motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-border bg-surface/30 motion-reduce:animate-none" />
    </div>
  );
}

/**
 * Session KPI cards + cohorts after first paint so list SSR is not blocked
 * by `GET /api/sessions/summary` (can take several seconds on large projects).
 */
export function DeferredSessionsKpis({ queryString }: { queryString: string }) {
  const { data, loading } = useDeferredAnalytics<SessionsPageSummary>(
    "/api/sessions/summary",
    queryString
  );

  if (loading) return <SessionsKpisSkeleton />;
  if (!data) return null;

  return (
    <>
      <SessionsSummaryMetrics summary={data} />
      <SessionsUserCohortMetrics summary={data} />
    </>
  );
}
