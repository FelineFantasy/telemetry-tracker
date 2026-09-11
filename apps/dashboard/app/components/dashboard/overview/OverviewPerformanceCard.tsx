"use client";

import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
  AnalyticsViewAllLink,
} from "@/app/components/dashboard/analytics-ui";
import { Badge } from "@/app/components/Badge";
import { buildDashboardScopedListHref, type DashboardListScope } from "@/lib/overview-scope-url";
import { useDeferredAnalytics } from "@/lib/use-deferred-analytics";
import type { PerformancePageSummary } from "@/lib/performance-summary";
import {
  buildOverviewPerformanceSummaryQuery,
  hasOverviewWebVitals,
  mapOverviewVitalRows,
  resolveOverviewPerformanceScope,
  type OverviewMetricsWindow,
  type OverviewVitalRow,
} from "@/lib/web-vitals-overview";

function VitalRatingBar({ row }: { row: OverviewVitalRow }) {
  const { ratingDistribution: rating, label } = row;
  if (rating.total <= 0) {
    return (
      <p className="text-[11px] text-muted-foreground">No samples</p>
    );
  }

  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/40"
      role="img"
      aria-label={`${label} rating distribution: ${rating.goodPct.toFixed(0)}% good, ${rating.needsImprovementPct.toFixed(0)}% needs improvement, ${rating.poorPct.toFixed(0)}% poor`}
    >
      {rating.goodPct > 0 ? (
        <div
          className="h-full bg-success"
          style={{ width: `${rating.goodPct}%` }}
          title={`Good ${rating.goodPct.toFixed(1)}%`}
        />
      ) : null}
      {rating.needsImprovementPct > 0 ? (
        <div
          className="h-full bg-warning"
          style={{ width: `${rating.needsImprovementPct}%` }}
          title={`Needs improvement ${rating.needsImprovementPct.toFixed(1)}%`}
        />
      ) : null}
      {rating.poorPct > 0 ? (
        <div
          className="h-full bg-destructive"
          style={{ width: `${rating.poorPct}%` }}
          title={`Poor ${rating.poorPct.toFixed(1)}%`}
        />
      ) : null}
    </div>
  );
}

function VitalsLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
      <span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" aria-hidden />{" "}
        Good
      </span>
      <span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning align-middle" aria-hidden />{" "}
        Needs improvement
      </span>
      <span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive align-middle" aria-hidden />{" "}
        Poor
      </span>
    </div>
  );
}

function OverviewPerformancePanel({
  rows,
  rangeLabel,
  performanceHref,
  empty,
  loadError,
}: {
  rows: OverviewVitalRow[];
  rangeLabel: string;
  performanceHref: string;
  empty: boolean;
  loadError?: boolean;
}) {
  return (
    <AnalyticsPanel aria-label="Performance overview">
      <AnalyticsPanelHeader
        title="Performance Overview"
        description={`Web Vitals health · ${rangeLabel.toLowerCase()}`}
        action={
          <AnalyticsViewAllLink href={performanceHref}>View report</AnalyticsViewAllLink>
        }
      />
      {loadError ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Couldn’t load Web Vitals for this scope. Try refreshing, or open the full Performance
          report.
        </p>
      ) : empty ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No Web Vitals yet for this scope. Instrument your browser SDK to capture LCP, INP, CLS,
          and TTFB.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4">
            {rows.map((row) => (
              <div key={row.metric} className="px-4 py-3">
                <div className="mb-2">
                  <p className="text-[11px] font-medium text-muted-foreground">{row.label}</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">
                    {row.valueDisplay ?? "—"}
                  </p>
                  {row.ratingLabel && row.badgeTone ? (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px]">
                      <span
                        className={
                          row.badgeTone === "success"
                            ? "h-1.5 w-1.5 rounded-full bg-success"
                            : row.badgeTone === "warning"
                              ? "h-1.5 w-1.5 rounded-full bg-warning"
                              : "h-1.5 w-1.5 rounded-full bg-destructive"
                        }
                        aria-hidden
                      />
                      <Badge variant={row.badgeTone}>{row.ratingLabel}</Badge>
                    </span>
                  ) : (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Insufficient data
                    </span>
                  )}
                </div>
                <VitalRatingBar row={row} />
              </div>
            ))}
          </div>
          <VitalsLegend />
        </>
      )}
    </AnalyticsPanel>
  );
}

export function OverviewPerformanceCardSkeleton() {
  return (
    <AnalyticsPanel aria-busy="true" aria-live="polite" aria-label="Loading performance overview">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
        <div className="mt-2 h-3 w-56 animate-pulse rounded bg-muted/40" />
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between gap-2">
              <div className="h-8 w-24 animate-pulse rounded bg-muted/40" />
              <div className="h-5 w-16 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="h-2 w-full animate-pulse rounded-full bg-muted/40" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading performance overview…</span>
    </AnalyticsPanel>
  );
}

/** Overview card: Web Vitals snapshot via `GET /api/performance/summary` after first paint (#197). */
export function OverviewPerformanceCard({
  listScope,
  rangeLabel,
  metricsSince,
  metricsUntil,
}: {
  listScope: DashboardListScope;
  rangeLabel: string;
  /** Resolved Overview KPI window (`metricsSince` from `/api/overview`). */
  metricsSince?: string | null;
  /** Resolved Overview KPI window (`metricsUntil` from `/api/overview`). */
  metricsUntil?: string | null;
}) {
  const metricsWindow: OverviewMetricsWindow | null =
    metricsSince && metricsUntil
      ? { since: metricsSince, until: metricsUntil }
      : null;
  const performanceScope = resolveOverviewPerformanceScope(listScope, metricsWindow);
  const performanceHref = buildDashboardScopedListHref(
    "/dashboard/performance",
    performanceScope
  );
  const { data: summary, loading } = useDeferredAnalytics<PerformancePageSummary>(
    "/api/performance/summary",
    buildOverviewPerformanceSummaryQuery(performanceScope).toString()
  );

  if (loading) {
    return <OverviewPerformanceCardSkeleton />;
  }

  if (summary == null) {
    return (
      <OverviewPerformancePanel
        rows={[]}
        rangeLabel={rangeLabel}
        performanceHref={performanceHref}
        empty={false}
        loadError
      />
    );
  }

  if (!hasOverviewWebVitals(summary)) {
    return (
      <OverviewPerformancePanel
        rows={[]}
        rangeLabel={summary.window.label || rangeLabel}
        performanceHref={performanceHref}
        empty
      />
    );
  }

  return (
    <OverviewPerformancePanel
      rows={mapOverviewVitalRows(summary)}
      rangeLabel={summary.window.label || rangeLabel}
      performanceHref={performanceHref}
      empty={false}
    />
  );
}
