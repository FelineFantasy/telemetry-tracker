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

type Props = {
  series: OverviewSeries;
  rangeLabel: string;
};

function tickLabel(iso: string, bucket: "hour" | "day"): string {
  const d = new Date(iso);
  return bucket === "hour" ? format(d, "HH:mm") : format(d, "MMM d");
}

export function OverviewTrendsChart({ series, rangeLabel }: Props) {
  const data = series.errors.map((e, i) => ({
    label: tickLabel(e.t, series.bucket),
    errors: e.count,
    events: series.events[i]?.count ?? 0,
  }));

  const summary = `Error and event volume over ${rangeLabel}. ${data.length} ${series.bucket === "hour" ? "hourly" : "daily"} buckets.`;

  return (
    <section
      className="overview-trends card mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm"
      aria-label="Volume trends"
    >
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Volume over time</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Error occurrences and event rows ({rangeLabel.toLowerCase()}, UTC buckets)
        </p>
      </div>
      <div
        className="overview-trends__chart w-full min-h-[260px]"
        role="img"
        aria-label={summary}
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(148, 163, 184, 0.2)" }}
            />
            <YAxis
              yAxisId="err"
              tick={{ fill: "rgba(248, 113, 113, 0.9)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(248, 113, 113, 0.25)" }}
              width={44}
            />
            <YAxis
              yAxisId="ev"
              orientation="right"
              tick={{ fill: "rgba(103, 79, 220, 0.95)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(103, 79, 220, 0.3)" }}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "var(--color-foreground)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              formatter={(value) => (value === "errors" ? "Errors" : "Events")}
            />
            <Line
              yAxisId="err"
              type="monotone"
              dataKey="errors"
              name="errors"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="ev"
              type="monotone"
              dataKey="events"
              name="events"
              stroke="#674fdc"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
