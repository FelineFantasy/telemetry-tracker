"use client";

import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
} from "@/app/components/dashboard/analytics-ui";
import { chartTooltipStyle, useChartColors } from "@/lib/use-chart-colors";

export const ERROR_TYPE_CHART_COLORS: Record<string, string> = {
  TypeError: "#f87171",
  ReferenceError: "#c084fc",
  "Network Error": "#60a5fa",
  "Validation Error": "#fbbf24",
  Other: "#94a3b8",
};

export type ErrorsStackedPoint = {
  t: string;
  TypeError: number;
  ReferenceError: number;
  "Network Error": number;
  "Validation Error": number;
  Other: number;
};

const STACK_KEYS = [
  "TypeError",
  "ReferenceError",
  "Network Error",
  "Validation Error",
  "Other",
] as const;

function tickLabel(iso: string, bucket: "hour" | "day" | "week"): string {
  const d = new Date(iso);
  if (bucket === "hour") return format(d, "HH:mm");
  if (bucket === "week") return format(d, "MMM d");
  return format(d, "MMM d");
}

function chartHasData(data: ErrorsStackedPoint[]): boolean {
  return data.some((row) =>
    STACK_KEYS.some((key) => row[key] > 0)
  );
}

export function ErrorsStackedChart({
  data,
  bucket,
  rangeLabel,
}: {
  data: ErrorsStackedPoint[];
  bucket: "hour" | "day" | "week";
  rangeLabel: string;
}) {
  const colors = useChartColors();
  const chartData = data.map((row) => ({
    ...row,
    label: tickLabel(row.t, bucket),
  }));
  const tooltipStyle = chartTooltipStyle(colors);

  return (
    <AnalyticsPanel className="p-4 sm:p-5" aria-label="Errors by type over time">
      <AnalyticsPanelHeader
        title="Errors by type"
        description={`Stacked occurrence volume (${rangeLabel.toLowerCase()}, UTC buckets)`}
        className="border-0 px-0 pt-0"
      />
      <div className="h-[240px] w-full">
        {!chartHasData(chartData) ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No errors in this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: colors.legend }}
              />
              {STACK_KEYS.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stackId="errors"
                  stroke={ERROR_TYPE_CHART_COLORS[key]}
                  fill={ERROR_TYPE_CHART_COLORS[key]}
                  fillOpacity={0.65}
                  strokeWidth={1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </AnalyticsPanel>
  );
}
