"use client";

import type { OverviewBarRow } from "@/lib/overview-bar-rows";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTooltipStyle, useChartColors } from "@/lib/use-chart-colors";

type Props = {
  title: string;
  subtitle: string;
  rows: OverviewBarRow[];
  /** Bar color — errors use danger tone, events primary */
  accent: "errors" | "events";
  emptyMessage: string;
};

export function OverviewTopBars({ title, subtitle, rows, accent, emptyMessage }: Props) {
  const colors = useChartColors();
  const data = [...rows].reverse();

  if (!rows.length) {
    return (
      <section className="overview-top-bars mb-6 overflow-hidden rounded-xl border border-border bg-surface/40 p-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    );
  }

  const fill = accent === "errors" ? colors.error : colors.event;
  const maxVal = Math.max(...rows.map((r) => r.value), 1);
  const tooltipStyle = chartTooltipStyle(colors);

  return (
    <section
      className="overview-top-bars mb-6 overflow-hidden rounded-xl border border-border bg-surface/40 p-4"
      aria-label={title}
    >
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="w-full" style={{ height: Math.min(320, 28 + rows.length * 36) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            barCategoryGap={4}
          >
            <XAxis type="number" domain={[0, maxVal]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={148}
              tick={{ fill: colors.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: colors.cursor }}
              contentStyle={tooltipStyle}
              labelStyle={{ color: colors.tooltipLabel }}
              itemStyle={{ color: colors.tooltipFg }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {data.map((_, i) => (
                <Cell key={i} fill={fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
