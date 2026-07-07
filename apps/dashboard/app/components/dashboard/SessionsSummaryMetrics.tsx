"use client";

import { AnalyticsPanel } from "@/app/components/dashboard/analytics-ui";
import {
  MiniSparkline,
  type SparklinePoint,
} from "@/app/components/dashboard/MiniSparkline";
import {
  calcDeltaPct,
  formatCompact,
  formatDeltaPct,
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
  bounceRatePct: number;
  bounceRatePctPrevious: number;
  crashFreeRatePct: number;
  crashFreeRatePctPrevious: number;
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

function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  const delta = formatDeltaPct(calcDeltaPct(current, previous));
  const good =
    delta.tone === "flat"
      ? "text-muted-foreground"
      : delta.tone === "up"
        ? invert
          ? "text-destructive"
          : "text-success"
        : invert
          ? "text-success"
          : "text-destructive";
  const arrow = delta.tone === "up" ? "▲" : delta.tone === "down" ? "▼" : "—";
  return (
    <p className={`mt-1 text-[11px] ${good}`}>
      <span aria-hidden>{arrow}</span> {delta.text}
    </p>
  );
}

function PpDelta({
  deltaPp,
  invert = false,
}: {
  deltaPp: number;
  invert?: boolean;
}) {
  const tone =
    Math.abs(deltaPp) < 0.05 ? "flat" : deltaPp > 0 ? "up" : "down";
  const good =
    tone === "flat"
      ? "text-muted-foreground"
      : tone === "up"
        ? invert
          ? "text-destructive"
          : "text-success"
        : invert
          ? "text-success"
          : "text-destructive";
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "—";
  const sign = deltaPp > 0 ? "+" : deltaPp < 0 ? "−" : "";
  const text =
    tone === "flat" ? "—" : `${sign}${Math.abs(deltaPp).toFixed(1)} pp`;
  return (
    <p className={`mt-1 text-[11px] ${good}`}>
      <span aria-hidden>{arrow}</span> {text}
    </p>
  );
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
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</p>
        {deltaMode === "pp" ? (
          <PpDelta deltaPp={current - previous} invert={invertDelta} />
        ) : (
          <Delta current={current} previous={previous} invert={invertDelta} />
        )}
      </div>
      <MiniSparkline
        data={sparkline}
        color="var(--chart-session, var(--chart-event))"
        className="h-8 w-full max-w-[140px]"
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
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y lg:grid-cols-5 lg:divide-y-0">
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
          label="Avg duration"
          value={formatDurationSec(summary.avgDurationSec)}
          current={summary.avgDurationSec}
          previous={summary.avgDurationSecPrevious}
          sparkline={summary.sparklines.avgDurationSec}
          sparklineLabel="Average session duration over time"
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
