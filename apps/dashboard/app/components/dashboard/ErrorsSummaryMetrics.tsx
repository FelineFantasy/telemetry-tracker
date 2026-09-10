import { MetricCard, MetricCardGrid } from "@/app/components/dashboard/MetricCard";
import {
  formatCompact,
  formatPct,
} from "@/lib/overview-format";

export type ErrorsPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  totalOccurrences: number;
  totalOccurrencesPrevious: number;
  affectedUsers: number;
  affectedUsersPrevious: number;
  uniqueGroups: number;
  uniqueGroupsPrevious: number;
  resolvedGroups: number;
  resolvedGroupsPrevious: number;
  eventsCount: number;
  eventsCountPrevious: number;
  errorRatePct: number;
  errorRatePctPrevious: number;
};

export function ErrorsSummaryMetrics({ summary }: { summary: ErrorsPageSummary }) {
  const errorRateDelta = summary.errorRatePct - summary.errorRatePctPrevious;

  return (
    <section aria-label="Errors summary metrics">
      <p className="mb-2.5 text-[12px] text-muted-foreground">
        {summary.window.label} · {summary.window.compareLabel}
      </p>
      <MetricCardGrid>
        <MetricCard
          label="Total errors"
          value={formatCompact(summary.totalOccurrences)}
          current={summary.totalOccurrences}
          previous={summary.totalOccurrencesPrevious}
          invertDelta
          accent="error"
        />
        <MetricCard
          label="Affected users"
          value={formatCompact(summary.affectedUsers)}
          current={summary.affectedUsers}
          previous={summary.affectedUsersPrevious}
          invertDelta
          accent="error"
        />
        <MetricCard
          label="Error rate"
          value={formatPct(summary.errorRatePct, 1)}
          current={summary.errorRatePct}
          previous={summary.errorRatePctPrevious}
          invertDelta
          deltaMode="pp"
          accent="session"
        />
        <MetricCard
          label="Unique errors"
          value={formatCompact(summary.uniqueGroups)}
          current={summary.uniqueGroups}
          previous={summary.uniqueGroupsPrevious}
          invertDelta
          accent="warning"
        />
        <MetricCard
          label="Resolved"
          value={formatCompact(summary.resolvedGroups)}
          current={summary.resolvedGroups}
          previous={summary.resolvedGroupsPrevious}
          accent="success"
        />
      </MetricCardGrid>
      <div className="sr-only" aria-live="polite">
        Error rate change {errorRateDelta.toFixed(1)} percentage points
      </div>
    </section>
  );
}
