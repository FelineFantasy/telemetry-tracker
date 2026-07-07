"use client";

import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
  AnalyticsPanelList,
} from "@/app/components/dashboard/analytics-ui";
import {
  ERROR_TYPE_CHART_COLORS,
} from "@/app/components/dashboard/ErrorsStackedChart";
import { MiniSparkline, type SparklinePoint } from "@/app/components/dashboard/MiniSparkline";
import { formatCompact, formatPct } from "@/lib/overview-format";

export type ErrorsTopTypeRow = {
  type: string;
  count: number;
  sharePct: number;
  sparkline: SparklinePoint[];
};

export function ErrorsTopTypesPanel({
  rows,
  rangeLabel,
}: {
  rows: ErrorsTopTypeRow[];
  rangeLabel: string;
}) {
  return (
    <AnalyticsPanel aria-label="Top error types">
      <AnalyticsPanelHeader
        title="Top error types"
        description={`Share of occurrences in ${rangeLabel.toLowerCase()}`}
      />
      {!rows.length ? (
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
          No typed errors in this period
        </p>
      ) : (
        <AnalyticsPanelList>
          {rows.map((row) => (
            <li
              key={row.type}
              className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: ERROR_TYPE_CHART_COLORS[row.type] ?? "#94a3b8" }}
                    aria-hidden
                  />
                  <p className="truncate text-[13px] font-medium">{row.type}</p>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatCompact(row.count)} occurrences · {formatPct(row.sharePct, 1)}
                </p>
              </div>
              <MiniSparkline
                data={row.sparkline}
                color={ERROR_TYPE_CHART_COLORS[row.type]}
                className="h-9 w-28 shrink-0"
                ariaLabel={`${row.type} trend`}
              />
            </li>
          ))}
        </AnalyticsPanelList>
      )}
    </AnalyticsPanel>
  );
}
