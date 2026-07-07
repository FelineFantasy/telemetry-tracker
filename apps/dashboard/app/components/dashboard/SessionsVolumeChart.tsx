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

export type SessionsVolumePoint = {
  t: string;
  count: number;
};

function tickLabel(iso: string, bucket: ChartBucket): string {
  const d = new Date(iso);
  if (bucket === "hour") return format(d, "HH:mm");
  if (bucket === "week") return format(d, "MMM d");
  return format(d, "MMM d");
}

function chartHasData(data: SessionsVolumePoint[]): boolean {
  return data.some((row) => row.count > 0);
}

export function SessionsVolumeChart({
  data,
  bucket,
  rangeLabel,
  path,
  currentParams,
}: {
  data: SessionsVolumePoint[];
  bucket: ChartBucket;
  rangeLabel: string;
  path: string;
  currentParams: Record<string, string>;
}) {
  const colors = useChartColors();
  const chartData = data.map((row) => ({
    ...row,
    label: tickLabel(row.t, bucket),
  }));
  const tooltipStyle = chartTooltipStyle(colors);

  return (
    <AnalyticsPanel className="p-4 sm:p-5" aria-label="Sessions over time">
      <AnalyticsPanelHeader
        title="Sessions over time"
        description={`Session volume (${rangeLabel.toLowerCase()}, UTC buckets)`}
        action={
          <AnalyticsChartBucketControl
            value={bucket}
            path={path}
            currentParams={currentParams}
          />
        }
        className="border-0 px-0 pt-0"
      />
      <div className="h-[240px] w-full">
        {!chartHasData(chartData) ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No sessions in this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="sessionsVolumeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.event} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={colors.event} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: colors.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: colors.axis }}
              />
              <YAxis
                tick={{ fill: colors.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: colors.tooltipLabel }}
                itemStyle={{ color: colors.tooltipFg }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Sessions"
                stroke={colors.event}
                strokeWidth={2}
                fill="url(#sessionsVolumeFill)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </AnalyticsPanel>
  );
}
