"use client";

import { format } from "date-fns";
import {
  Area,
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
    sessions: series.sessions?.[i]?.count ?? 0,
  }));

  const summary = `Error, event, and session volume over ${rangeLabel}. ${data.length} ${bucketUnit(series.bucket)} buckets.`;
  const tooltipStyle = chartTooltipStyle(colors);
  const hasSessions = (series.sessions?.length ?? 0) > 0;

  return (
    <AnalyticsPanel className="overview-trends p-4 sm:p-5" aria-label="Volume trends">
      <AnalyticsPanelHeader
        title="Telemetry volume"
        description={`Errors, events, and sessions (${rangeLabel.toLowerCase()}, UTC buckets)`}
        className="border-0 px-0 pt-0"
      />
      <div
        className="overview-trends__chart w-full min-h-[300px]"
        role="img"
        aria-label={summary}
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="overview-events-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.event} stopOpacity={0.28} />
                <stop offset="100%" stopColor={colors.event} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="overview-errors-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.error} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors.error} stopOpacity={0} />
              </linearGradient>
              {hasSessions ? (
                <linearGradient id="overview-sessions-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              ) : null}
            </defs>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.axis }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: colors.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: colors.tooltipLabel }}
              itemStyle={{ color: colors.tooltipFg }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: colors.legend }}
              formatter={(value) => {
                if (value === "errors") return "Errors";
                if (value === "sessions") return "Sessions";
                return "Events";
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="events"
              name="events"
              stroke={colors.event}
              fill="url(#overview-events-fill)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="errors"
              name="errors"
              stroke={colors.error}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {hasSessions ? (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sessions"
                name="sessions"
                stroke="#34d399"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4 }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsPanel>
  );
}
