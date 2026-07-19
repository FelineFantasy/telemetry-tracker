import Link from "next/link";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
} from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { Pagination } from "@/app/components/ui/Pagination";
import { Table } from "@/app/components/ui/Table";
import {
  buildSlowPageWebVitalEventsHref,
  type DashboardListScope,
} from "@/lib/overview-scope-url";
import type { SlowPageRow } from "@/lib/performance-summary";

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCls(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(3);
}

function SmallSampleHint() {
  return (
    <span
      className="ml-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300"
      title="Fewer than 5 LCP samples — ranking may be noisy"
    >
      Low n
    </span>
  );
}

export function PerformanceSlowPagesTable({
  items,
  total,
  page,
  pageSize,
  scope,
  rangeLabel,
  hrefForPage,
}: {
  items: SlowPageRow[];
  total: number;
  page: number;
  pageSize: number;
  scope: DashboardListScope;
  rangeLabel: string;
  hrefForPage: (page: number) => string;
}) {
  return (
    <AnalyticsPanel aria-label="Slow pages">
      <AnalyticsPanelHeader
        title="Slow pages"
        description={`Sorted by LCP p75 · ${rangeLabel}`}
      />
      {items.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            title="No slow pages yet"
            message="Send `$web_vital` events from the browser SDK to see LCP and CLS by page path."
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border-t border-border">
            <Table>
              <thead>
                <tr>
                  <th>Page / path</th>
                  <th className="text-right">LCP p75</th>
                  <th className="hidden sm:table-cell text-right">CLS</th>
                  <th className="text-right">Samples</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const eventsHref = buildSlowPageWebVitalEventsHref(row.path, scope);
                  return (
                    <tr key={row.path}>
                      <td>
                        <Link
                          href={eventsHref}
                          className="font-mono text-[12.5px] text-foreground underline-offset-4 hover:text-brand hover:underline"
                        >
                          {row.path}
                        </Link>
                        {row.smallSample ? <SmallSampleHint /> : null}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {formatDurationMs(row.lcpP75)}
                      </td>
                      <td className="hidden sm:table-cell text-right tabular-nums">
                        {formatCls(row.clsP75)}
                      </td>
                      <td className="text-right tabular-nums">
                        {row.sampleCount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          {total > pageSize ? (
            <div className="border-t border-border px-4 py-3 sm:px-5">
              <Pagination
                total={total}
                page={page}
                pageSize={pageSize}
                hrefForPage={hrefForPage}
              />
            </div>
          ) : null}
        </>
      )}
    </AnalyticsPanel>
  );
}
