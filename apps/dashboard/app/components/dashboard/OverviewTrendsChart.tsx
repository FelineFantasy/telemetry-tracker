"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OverviewSeries } from "@/lib/overview-api";
import { AnalyticsPanel, AnalyticsPanelHeader } from "@/app/components/dashboard/analytics-ui";
import { chartTooltipStyle, useChartColors } from "@/lib/use-chart-colors";

type Props = {
  series: OverviewSeries;
  rangeLabel: string;
};

function tickLabel(iso: string, bucket: "hour" | "day" | "week"): string {
  const d = new Date(iso);
  if (bucket === "hour") return format(d, "HH:mm");
  if (bucket === "week") return format(d, "MMM d");
  return format(d, "MMM d");
}

function bucketUnit(bucket: "hour" | "day" | "week"): string {
  if (bucket === "hour") return "hourly";
  if (bucket === "week") return "weekly";
  return "daily";
}

export function OverviewTrendsChart({ series, rangeLabel }: Props) {
  const colors = useChartColors();
  const data = series.errors.map((e, i) => ({
    label: tickLabel(e.t, series.bucket),
    errors: e.count,
    events: series.events[i]?.count ?? 0,
  }));

  const summary = `Error and event volume over ${rangeLabel}. ${data.length} ${bucketUnit(series.bucket)} buckets.`;
  const tooltipStyle = chartTooltipStyle(colors);

  return (
    <AnalyticsPanel className="overview-trends p-4 sm:p-5" aria-label="Volume trends">
      <AnalyticsPanelHeader
        title="Volume over time"
        description={`Error occurrences and event rows (${rangeLabel.toLowerCase()}, UTC buckets)`}
        className="border-0 px-0 pt-0"
      />
      <div
        className="overview-trends__chart w-full min-h-[260px]"
        role="img"
        aria-label={summary}
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.axis }}
            />
            <YAxis
              yAxisId="err"
              tick={{ fill: colors.error, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.error }}
            />
            <YAxis
              yAxisId="ev"
              orientation="right"
              tick={{ fill: colors.event, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.event }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: colors.tooltipLabel }}
              itemStyle={{ color: colors.tooltipFg }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: colors.legend }}
              formatter={(value) => (value === "errors" ? "Errors" : "Events")}
            />
            <Line
              yAxisId="err"
              type="monotone"
              dataKey="errors"
              name="errors"
              stroke={colors.error}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="ev"
              type="monotone"
              dataKey="events"
              name="events"
              stroke={colors.event}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsPanel>
  );
}
