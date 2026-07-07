"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
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

export type EventsVolumePoint = {
  t: string;
  count: number;
};

function tickLabel(iso: string, bucket: "hour" | "day" | "week"): string {
  const d = new Date(iso);
  if (bucket === "hour") return format(d, "HH:mm");
  if (bucket === "week") return format(d, "MMM d");
  return format(d, "MMM d");
}

function chartHasData(data: EventsVolumePoint[]): boolean {
  return data.some((row) => row.count > 0);
}

export function EventsVolumeChart({
  data,
  bucket,
  rangeLabel,
}: {
  data: EventsVolumePoint[];
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
    <AnalyticsPanel className="p-4 sm:p-5" aria-label="Events over time">
      <AnalyticsPanelHeader
        title="Events over time"
        description={`Event volume (${rangeLabel.toLowerCase()}, UTC buckets)`}
        className="border-0 px-0 pt-0"
      />
      <div className="h-[240px] w-full">
        {!chartHasData(chartData) ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No events in this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
              <Line
                type="monotone"
                dataKey="count"
                name="Events"
                stroke={colors.event}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </AnalyticsPanel>
  );
}
