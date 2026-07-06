"use client";

import type { OverviewBarRow } from "@/lib/overview-bar-rows";
import { useEffect, useState } from "react";
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

function useCompactBarLayout(): boolean {
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setCompact(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return compact;
}

function MobileBarList({
  rows,
  fill,
  maxVal,
}: {
  rows: OverviewBarRow[];
  fill: string;
  maxVal: number;
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row, index) => {
        const pct =
          maxVal > 0 && row.value > 0
            ? Math.max(2, Math.round((row.value / maxVal) * 100))
            : 0;
        return (
          <li key={`${index}-${row.value}`}>
            <p className="truncate text-xs text-foreground" title={row.label}>
              {row.label}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded"
                  style={{ width: `${pct}%`, backgroundColor: fill }}
                />
              </div>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {row.value.toLocaleString()}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function OverviewTopBars({ title, subtitle, rows, accent, emptyMessage }: Props) {
  const colors = useChartColors();
  const compact = useCompactBarLayout();
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

      {compact ? (
        <MobileBarList rows={rows} fill={fill} maxVal={maxVal} />
      ) : (
        <div
          className="w-full"
          style={{ height: Math.min(320, 28 + rows.length * 36) }}
        >
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
      )}
    </section>
  );
}
