"use client";

import {
  AnalyticsPanel,
  MetricDelta,
} from "@/app/components/dashboard/analytics-ui";
import {
  MiniSparkline,
  type SparklinePoint,
} from "@/app/components/dashboard/MiniSparkline";
import {
  formatCompact,
  formatPct,
} from "@/lib/overview-format";

export type SessionsPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  totalSessions: number;
  totalSessionsPrevious: number;
  distinctUsers: number;
  distinctUsersPrevious: number;
  avgDurationSec: number;
  avgDurationSecPrevious: number;
  avgDurationPerUserSec: number;
  avgDurationPerUserSecPrevious: number;
  bounceRatePct: number;
  bounceRatePctPrevious: number;
  crashFreeRatePct: number;
  crashFreeRatePctPrevious: number;
  userCohorts: {
    newUsers: number;
    returningUsers: number;
    newUsersPrevious: number;
    returningUsersPrevious: number;
    newUsersPct: number;
    returningUsersPct: number;
    newUsersPctPrevious: number;
    returningUsersPctPrevious: number;
  };
  sparklines: {
    totalSessions: SparklinePoint[];
    distinctUsers: SparklinePoint[];
    avgDurationSec: SparklinePoint[];
    bounceRatePct: SparklinePoint[];
    crashFreeRatePct: SparklinePoint[];
  };
};

function formatDurationSec(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function MetricCell({
  label,
  value,
  current,
  previous,
  invertDelta,
  deltaMode = "relative",
  sparkline,
  sparklineLabel,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  invertDelta?: boolean;
  deltaMode?: "relative" | "pp";
  sparkline: SparklinePoint[];
  sparklineLabel: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</p>
        <MetricDelta
          current={current}
          previous={previous}
          invert={invertDelta}
          mode={deltaMode}
        />
      </div>
      <MiniSparkline
        data={sparkline}
        color="var(--chart-session, var(--chart-event))"
        className="h-8 w-[120px] shrink-0 sm:w-[140px]"
        ariaLabel={sparklineLabel}
      />
    </div>
  );
}

export function SessionsSummaryMetrics({ summary }: { summary: SessionsPageSummary }) {
  return (
    <AnalyticsPanel aria-label="Sessions summary metrics">
      <div className="border-b border-border px-4 py-2 sm:px-5">
        <p className="text-[12px] text-muted-foreground">
          {summary.window.label} · {summary.window.compareLabel}
        </p>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y lg:grid-cols-3 lg:divide-y-0 xl:grid-cols-6">
        <MetricCell
          label="Total sessions"
          value={formatCompact(summary.totalSessions)}
          current={summary.totalSessions}
          previous={summary.totalSessionsPrevious}
          sparkline={summary.sparklines.totalSessions}
          sparklineLabel="Sessions over time"
        />
        <MetricCell
          label="Users"
          value={formatCompact(summary.distinctUsers)}
          current={summary.distinctUsers}
          previous={summary.distinctUsersPrevious}
          sparkline={summary.sparklines.distinctUsers}
          sparklineLabel="Distinct users over time"
        />
        <MetricCell
          label="Avg duration / session"
          value={formatDurationSec(summary.avgDurationSec)}
          current={summary.avgDurationSec}
          previous={summary.avgDurationSecPrevious}
          sparkline={summary.sparklines.avgDurationSec}
          sparklineLabel="Average session duration over time"
        />
        <MetricCell
          label="Avg time / user"
          value={formatDurationSec(summary.avgDurationPerUserSec)}
          current={summary.avgDurationPerUserSec}
          previous={summary.avgDurationPerUserSecPrevious}
          sparkline={summary.sparklines.totalSessions.map((p) => ({ t: p.t, count: null }))}
          sparklineLabel="Average total time per user over time"
        />
        <MetricCell
          label="Bounce rate"
          value={formatPct(summary.bounceRatePct, 1)}
          current={summary.bounceRatePct}
          previous={summary.bounceRatePctPrevious}
          invertDelta
          deltaMode="pp"
          sparkline={summary.sparklines.bounceRatePct}
          sparklineLabel="Bounce rate over time"
        />
        <MetricCell
          label="Crash-free"
          value={formatPct(summary.crashFreeRatePct, 1)}
          current={summary.crashFreeRatePct}
          previous={summary.crashFreeRatePctPrevious}
          sparkline={summary.sparklines.crashFreeRatePct}
          sparklineLabel="Crash-free session rate over time"
        />
      </div>
    </AnalyticsPanel>
  );
}
