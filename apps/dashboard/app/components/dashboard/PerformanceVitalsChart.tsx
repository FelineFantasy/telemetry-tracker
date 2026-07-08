"use client";

import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnalyticsChartBucketControl,
  type ChartBucket,
} from "@/app/components/dashboard/AnalyticsChartBucketControl";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
} from "@/app/components/dashboard/analytics-ui";
import { chartTooltipStyle, useChartColors } from "@/lib/use-chart-colors";
import type { PerformancePageSummary, WebVitalMetricSummary } from "@/lib/performance-summary";

const VITAL_ORDER = ["LCP", "INP", "CLS", "TTFB"] as const;

const VITAL_LABELS: Record<(typeof VITAL_ORDER)[number], string> = {
  LCP: "LCP",
  INP: "INP / FID",
  CLS: "CLS",
  TTFB: "TTFB",
};

function tickLabel(iso: string, bucket: ChartBucket): string {
  const d = new Date(iso);
  if (bucket === "hour") return format(d, "HH:mm");
  if (bucket === "week") return format(d, "MMM d");
  return format(d, "MMM d");
}

function formatTooltipValue(metric: WebVitalMetricSummary["metric"], value: number | null): string {
  if (value == null) return "—";
  if (metric === "CLS") return value.toFixed(3);
  return `${value} ms`;
}

function VitalAreaChart({
  metric,
  vital,
  bucket,
  colors,
}: {
  metric: (typeof VITAL_ORDER)[number];
  vital: WebVitalMetricSummary;
  bucket: ChartBucket;
  colors: ReturnType<typeof useChartColors>;
}) {
  const chartData = vital.series.map((row) => ({
    label: tickLabel(row.t, bucket),
    value: row.value,
  }));
  const hasData = chartData.some((row) => row.value != null);
  const gradientId = `perf-vital-${metric.toLowerCase()}`;
  const tooltipStyle = chartTooltipStyle(colors);

  return (
    <div className="rounded-lg border border-border/60 bg-surface/20 p-3">
      <p className="mb-2 text-[12px] font-medium">{VITAL_LABELS[metric]}</p>
      <div className="h-[160px] w-full">
        {!hasData ? (
          <p className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
            No samples
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-performance, #a78bfa)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-performance, #a78bfa)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: colors.axis }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: colors.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={metric === "CLS" ? 40 : 44}
                tickFormatter={(v: number) => (metric === "CLS" ? v.toFixed(2) : String(v))}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: colors.tooltipLabel }}
                itemStyle={{ color: colors.tooltipFg }}
                formatter={(value) =>
                  formatTooltipValue(metric, typeof value === "number" ? value : null)
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                name={`${VITAL_LABELS[metric]} p75`}
                stroke="var(--chart-performance, #a78bfa)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function PerformanceVitalsChart({
  summary,
  rangeLabel,
  path,
  currentParams,
}: {
  summary: PerformancePageSummary;
  rangeLabel: string;
  path: string;
  currentParams: Record<string, string>;
}) {
  const colors = useChartColors();
  const bucket = summary.bucket;

  return (
    <AnalyticsPanel className="p-4 sm:p-5" aria-label="Web vitals over time">
      <AnalyticsPanelHeader
        title="Web vitals over time"
        description={`p75 by ${bucket} (${rangeLabel.toLowerCase()}, UTC buckets)`}
        action={
          <AnalyticsChartBucketControl
            value={bucket}
            path={path}
            currentParams={currentParams}
          />
        }
        className="border-0 px-0 pt-0"
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {VITAL_ORDER.map((key) => (
          <VitalAreaChart
            key={key}
            metric={key}
            vital={summary.webVitals.vitals[key]}
            bucket={bucket}
            colors={colors}
          />
        ))}
      </div>
    </AnalyticsPanel>
  );
}
