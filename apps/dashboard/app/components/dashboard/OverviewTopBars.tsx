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

type Props = {
  title: string;
  subtitle: string;
  rows: OverviewBarRow[];
  /** Bar color — errors use danger tone, events primary */
  accent: "errors" | "events";
  emptyMessage: string;
};

const FILL = {
  errors: "#f87171",
  events: "#8a7de4",
} as const;

export function OverviewTopBars({ title, subtitle, rows, accent, emptyMessage }: Props) {
  const data = [...rows].reverse();

  if (!rows.length) {
    return (
      <section className="overview-top-bars card mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      </section>
    );
  }

  const fill = FILL[accent];
  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  return (
    <section
      className="overview-top-bars card mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm"
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
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            barCategoryGap={4}
          >
            <XAxis type="number" domain={[0, maxVal]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "rgba(103, 79, 220, 0.06)" }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
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
