"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
} from "@/app/components/dashboard/analytics-ui";
import { formatCompact, formatPct } from "@/lib/overview-format";
import { chartTooltipStyle, useChartColors } from "@/lib/use-chart-colors";

export type EventsTopEventRow = {
  name: string;
  count: number;
  sharePct: number;
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

function truncateLabel(value: string, max = 42): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function MobileBarList({
  rows,
  fill,
  maxVal,
}: {
  rows: EventsTopEventRow[];
  fill: string;
  maxVal: number;
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const pct =
          maxVal > 0 && row.count > 0
            ? Math.max(2, Math.round((row.count / maxVal) * 100))
            : 0;
        return (
          <li key={row.name}>
            <p className="truncate text-xs font-medium text-foreground" title={row.name}>
              {truncateLabel(row.name)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatCompact(row.count)} events · {formatPct(row.sharePct, 1)}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded"
                  style={{ width: `${pct}%`, backgroundColor: fill }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EventsTopEventsPanel({
  rows,
  rangeLabel,
}: {
  rows: EventsTopEventRow[];
  rangeLabel: string;
}) {
  const colors = useChartColors();
  const compact = useCompactBarLayout();
  const fill = colors.event;
  const maxVal = Math.max(...rows.map((row) => row.count), 1);
  const tooltipStyle = chartTooltipStyle(colors);
  const chartRows = useMemo(
    () =>
      [...rows]
        .reverse()
        .map((row) => ({
          label: truncateLabel(row.name),
          value: row.count,
          sharePct: row.sharePct,
        })),
    [rows]
  );

  return (
    <AnalyticsPanel aria-label="Top events">
      <AnalyticsPanelHeader
        title="Top events"
        description={`Share of occurrences in ${rangeLabel.toLowerCase()}`}
      />
      {!rows.length ? (
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
          No events in this period
        </p>
      ) : compact ? (
        <div className="px-4 pb-4 sm:px-5">
          <MobileBarList rows={rows} fill={fill} maxVal={maxVal} />
        </div>
      ) : (
        <div
          className="w-full px-2 pb-4"
          style={{ height: Math.min(320, 28 + rows.length * 36) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartRows}
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
                formatter={(value: number, _name, item) => [
                  `${value.toLocaleString()} · ${formatPct(item.payload.sharePct, 1)}`,
                  "Events",
                ]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartRows.map((_, index) => (
                  <Cell key={index} fill={fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AnalyticsPanel>
  );
}
