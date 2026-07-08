"use client";

import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
} from "@/app/components/dashboard/analytics-ui";
import type { PerformancePageSummary, WebVitalMetricSummary } from "@/lib/performance-summary";

const VITAL_ORDER = ["LCP", "INP", "CLS", "TTFB"] as const;

const VITAL_LABELS: Record<(typeof VITAL_ORDER)[number], string> = {
  LCP: "LCP",
  INP: "INP / FID",
  CLS: "CLS",
  TTFB: "TTFB",
};

function RatingBar({ vital }: { vital: WebVitalMetricSummary }) {
  const { rating } = vital;
  if (rating.total <= 0) {
    return (
      <p className="text-[12px] text-muted-foreground">No samples in this period</p>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40"
        role="img"
        aria-label={`${VITAL_LABELS[vital.metric]} rating distribution: ${rating.goodPct.toFixed(0)}% good, ${rating.needsImprovementPct.toFixed(0)}% needs improvement, ${rating.poorPct.toFixed(0)}% poor`}
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-success align-middle" aria-hidden />{" "}
          Good {rating.goodPct.toFixed(0)}%
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-warning align-middle" aria-hidden />{" "}
          Needs improvement {rating.needsImprovementPct.toFixed(0)}%
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-destructive align-middle" aria-hidden />{" "}
          Poor {rating.poorPct.toFixed(0)}%
        </span>
        <span className="tabular-nums">{rating.total.toLocaleString()} samples</span>
      </div>
    </div>
  );
}

export function PerformanceRatingDistribution({
  summary,
  rangeLabel,
}: {
  summary: PerformancePageSummary;
  rangeLabel: string;
}) {
  return (
    <AnalyticsPanel aria-label="Web vitals rating distribution">
      <AnalyticsPanelHeader
        title="Rating distribution"
        description={`Good / Needs improvement / Poor share (${rangeLabel.toLowerCase()})`}
      />
      <div className="divide-y divide-border">
        {VITAL_ORDER.map((key) => {
          const vital = summary.webVitals.vitals[key];
          return (
            <div key={key} className="px-4 py-4 sm:px-5">
              <p className="mb-2 text-[12px] font-medium">{VITAL_LABELS[key]}</p>
              <RatingBar vital={vital} />
            </div>
          );
        })}
      </div>
    </AnalyticsPanel>
  );
}
