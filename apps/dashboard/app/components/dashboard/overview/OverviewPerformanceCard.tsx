import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
  AnalyticsViewAllLink,
} from "@/app/components/dashboard/analytics-ui";
import { Badge } from "@/app/components/Badge";
import { fetchPerformanceSummary } from "@/lib/performance-summary";
import { buildDashboardScopedListHref, type DashboardListScope } from "@/lib/overview-scope-url";
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
      <p className="text-[12px] text-muted-foreground">No samples in this period</p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted/40"
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
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" aria-hidden />{" "}
          Good {rating.goodPct.toFixed(0)}%
        </span>
        <span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning align-middle" aria-hidden />{" "}
          Needs improvement {rating.needsImprovementPct.toFixed(0)}%
        </span>
        <span>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-destructive align-middle"
            aria-hidden
          />{" "}
          Poor {rating.poorPct.toFixed(0)}%
        </span>
      </div>
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
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          Couldn’t load Web Vitals for this scope. Try refreshing, or open the full Performance
          report.
        </p>
      ) : empty ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          No Web Vitals yet for this scope. Instrument your browser SDK to capture LCP, INP, CLS,
          and TTFB.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.metric} className="px-4 py-3.5 sm:px-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium">{row.label}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
                    {row.valueDisplay ?? "—"}
                  </p>
                </div>
                {row.ratingLabel && row.badgeTone ? (
                  <Badge variant={row.badgeTone}>{row.ratingLabel}</Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Insufficient data</span>
                )}
              </div>
              <VitalRatingBar row={row} />
            </div>
          ))}
        </div>
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

/** Async Overview card: Web Vitals snapshot via `GET /api/performance/summary` (#197). */
export async function OverviewPerformanceCard({
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
  const summary = await fetchPerformanceSummary(
    buildOverviewPerformanceSummaryQuery(performanceScope)
  );

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
