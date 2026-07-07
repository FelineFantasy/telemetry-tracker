"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
} from "@/app/components/dashboard/analytics-ui";
import { EVENT_PLATFORM_CHART_COLORS } from "@/app/components/dashboard/EventsPlatformDonut";
import { formatCompact, formatPct } from "@/lib/overview-format";
import { chartTooltipStyle, useChartColors } from "@/lib/use-chart-colors";

export type SessionsPlatformSlice = {
  platform: string;
  count: number;
  sharePct: number;
};

export function SessionsPlatformDonut({
  slices,
  rangeLabel,
}: {
  slices: SessionsPlatformSlice[];
  rangeLabel: string;
}) {
  const colors = useChartColors();
  const tooltipStyle = chartTooltipStyle(colors);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <AnalyticsPanel aria-label="Sessions by platform">
      <AnalyticsPanelHeader
        title="Sessions by platform"
        description={`Distribution in ${rangeLabel.toLowerCase()}`}
      />
      {!slices.length ? (
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
          No platform data in this period
        </p>
      ) : (
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:px-5">
          <div className="mx-auto h-[180px] w-full max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="platform"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="transparent"
                >
                  {slices.map((slice) => (
                    <Cell
                      key={slice.platform}
                      fill={EVENT_PLATFORM_CHART_COLORS[slice.platform] ?? colors.tick}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: colors.tooltipLabel }}
                  itemStyle={{ color: colors.tooltipFg }}
                  formatter={(value: number, _name, item) => [
                    `${formatCompact(value)} · ${formatPct(item.payload.sharePct, 1)}`,
                    item.payload.platform,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2">
            {slices.map((slice) => (
              <li key={slice.platform} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        EVENT_PLATFORM_CHART_COLORS[slice.platform] ?? colors.tick,
                    }}
                    aria-hidden
                  />
                  <span className="truncate">{slice.platform}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatCompact(slice.count)} · {formatPct(slice.sharePct, 1)}
                </span>
              </li>
            ))}
            <li className="border-t border-border pt-2 text-[11px] text-muted-foreground">
              {formatCompact(total)} sessions total
            </li>
          </ul>
        </div>
      )}
    </AnalyticsPanel>
  );
}
