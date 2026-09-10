"use client";

import { MetricCard, MetricCardGrid } from "@/app/components/dashboard/MetricCard";
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

function toSparkline(series: { t: string; value: number | null }[]) {
  return series.map((point) => ({ t: point.t, count: point.value }));
}

function RequestLatencyCards({
  latency,
  compareText,
}: {
  latency: Extract<PerformanceRequestLatency, { available: true }>;
  compareText: string;
}) {
  return (
    <>
      <MetricCard
        label="Avg response"
        value={formatDurationMs(latency.avgMs)}
        current={latency.avgMs}
        previous={latency.avgMsPrevious}
        invertDelta
        sparkline={toSparkline(latency.series.avgMs)}
        sparklineLabel="Average response time over time"
        compareText={compareText}
        accent="warning"
      />
      <MetricCard
        label="Apdex"
        value={formatApdex(latency.apdex)}
        current={latency.apdex * 100}
        previous={latency.apdexPrevious == null ? null : latency.apdexPrevious * 100}
        deltaMode="pp"
        sparkline={toSparkline(latency.series.apdexPct)}
        sparklineLabel="Apdex score over time"
        compareText={compareText}
        accent="warning"
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
      ? "lg:grid-cols-3 xl:grid-cols-6"
      : totalCols === 4
        ? "lg:grid-cols-4 xl:grid-cols-4"
        : totalCols === 2
          ? "xl:grid-cols-2"
          : "lg:grid-cols-4 xl:grid-cols-4";

  return (
    <section aria-label="Performance summary metrics">
      <p className="mb-2.5 text-[12px] text-muted-foreground">
        {summary.window.label} · {summary.window.compareLabel}
      </p>
      <MetricCardGrid className={gridCols}>
        {showVitals
          ? VITAL_ORDER.map((key) => {
              const vital = summary.webVitals.vitals[key];
              return (
                <MetricCard
                  key={key}
                  label={VITAL_LABELS[key]}
                  value={formatVitalValue(key, vital.p75)}
                  current={vital.p75 ?? 0}
                  previous={vital.p75Previous}
                  invertDelta
                  sparkline={toSparkline(vital.series)}
                  sparklineLabel={`${VITAL_LABELS[key]} p75 over time`}
                  compareText={compareText}
                  accent="warning"
                />
              );
            })
          : null}
        {latency ? (
          <RequestLatencyCards latency={latency} compareText={compareText} />
        ) : null}
      </MetricCardGrid>
    </section>
  );
}
