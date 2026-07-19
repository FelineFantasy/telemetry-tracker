"use client";

import {
  AnalyticsPanel,
  MetricDelta,
} from "@/app/components/dashboard/analytics-ui";
import {
  MiniSparkline,
  type SparklinePoint,
} from "@/app/components/dashboard/MiniSparkline";
import { formatPct } from "@/lib/overview-format";
import type {
  PerformancePageSummary,
  PerformanceRequestLatency,
  WebVitalMetricSummary,
} from "@/lib/performance-summary";

const VITAL_ORDER = ["LCP", "INP", "CLS", "TTFB"] as const;

const VITAL_LABELS: Record<(typeof VITAL_ORDER)[number], string> = {
  LCP: "LCP",
  INP: "INP / FID",
  CLS: "CLS",
  TTFB: "TTFB",
};

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatVitalValue(metric: WebVitalMetricSummary["metric"], value: number | null): string {
  if (value == null) return "—";
  if (metric === "CLS") return value.toFixed(3);
  return formatDurationMs(value);
}

function formatApdex(score: number): string {
  return formatPct(score * 100, 1);
}

function toSparkline(series: { t: string; value: number | null }[]): SparklinePoint[] {
  return series.map((point) => ({ t: point.t, count: point.value }));
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
  compareText,
}: {
  label: string;
  value: string;
  current: number;
  previous: number | null;
  invertDelta?: boolean;
  deltaMode?: "relative" | "pp";
  sparkline?: SparklinePoint[];
  sparklineLabel?: string;
  compareText: string;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</p>
        {previous == null ? (
          <p className="mt-1 text-[11px] text-muted-foreground">— {compareText}</p>
        ) : (
          <MetricDelta
            current={current}
            previous={previous}
            invert={invertDelta}
            mode={deltaMode}
            compareText={compareText}
          />
        )}
      </div>
      {sparkline && sparklineLabel ? (
        <MiniSparkline
          data={sparkline}
          color="var(--chart-performance, #a78bfa)"
          className="h-10 w-full sm:h-8 lg:max-w-[140px]"
          ariaLabel={sparklineLabel}
        />
      ) : null}
    </div>
  );
}

function RequestLatencyMetrics({
  latency,
  compareText,
}: {
  latency: Extract<PerformanceRequestLatency, { available: true }>;
  compareText: string;
}) {
  return (
    <>
      <MetricCell
        label="Avg response"
        value={formatDurationMs(latency.avgMs)}
        current={latency.avgMs}
        previous={latency.avgMsPrevious}
        invertDelta
        sparkline={toSparkline(latency.series.avgMs)}
        sparklineLabel="Average response time over time"
        compareText={compareText}
      />
      <MetricCell
        label="Apdex"
        value={formatApdex(latency.apdex)}
        current={latency.apdex * 100}
        previous={
          latency.apdexPrevious == null ? null : latency.apdexPrevious * 100
        }
        deltaMode="pp"
        sparkline={toSparkline(latency.series.apdexPct)}
        sparklineLabel="Apdex score over time"
        compareText={compareText}
      />
    </>
  );
}

export function PerformanceSummaryMetrics({ summary }: { summary: PerformancePageSummary }) {
  const compareText = summary.window.compareLabel;
  const showVitals = summary.webVitals.available;
  const latency =
    summary.requestLatency.available === true ? summary.requestLatency : null;
  const vitalCount = showVitals ? VITAL_ORDER.length : 0;
  const extraCount = latency ? 2 : 0;
  const totalCols = vitalCount + extraCount;
  const gridCols =
    totalCols >= 6
      ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      : totalCols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : totalCols === 2
          ? "sm:grid-cols-2"
          : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <AnalyticsPanel aria-label="Performance summary metrics">
      <div className="border-b border-border px-4 py-2 sm:px-5">
        <p className="text-[12px] text-muted-foreground">
          {summary.window.label} · {summary.window.compareLabel}
        </p>
      </div>
      <div className={`grid grid-cols-1 divide-y divide-border ${gridCols} lg:divide-x lg:divide-y-0`}>
        {showVitals
          ? VITAL_ORDER.map((key) => {
              const vital = summary.webVitals.vitals[key];
              return (
                <MetricCell
                  key={key}
                  label={VITAL_LABELS[key]}
                  value={formatVitalValue(key, vital.p75)}
                  current={vital.p75 ?? 0}
                  previous={vital.p75Previous}
                  invertDelta
                  sparkline={toSparkline(vital.series)}
                  sparklineLabel={`${VITAL_LABELS[key]} p75 over time`}
                  compareText={compareText}
                />
              );
            })
          : null}
        {latency ? (
          <RequestLatencyMetrics latency={latency} compareText={compareText} />
        ) : null}
      </div>
    </AnalyticsPanel>
  );
}
