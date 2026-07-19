import Link from "next/link";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
} from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { Pagination } from "@/app/components/ui/Pagination";
import { Table } from "@/app/components/ui/Table";
import { formatPct } from "@/lib/overview-format";
import {
  buildSlowRouteEventsHref,
  scopeForPerformanceEventsDrillDown,
  type DashboardListScope,
} from "@/lib/overview-scope-url";
import type { SlowRouteRow } from "@/lib/performance-summary";

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function SmallSampleHint() {
  return (
    <span
      className="ml-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300"
      title="Fewer than 5 requests — ranking may be noisy"
    >
      Low n
    </span>
  );
}

export function PerformanceSlowRoutesTable({
  items,
  total,
  page,
  pageSize,
  scope,
  metricsWindow,
  rangeLabel,
  hrefForPage,
}: {
  items: SlowRouteRow[];
  total: number;
  page: number;
  pageSize: number;
  scope: DashboardListScope;
  metricsWindow: { since: string; until: string };
  rangeLabel: string;
  hrefForPage: (page: number) => string;
}) {
  const eventsScope = scopeForPerformanceEventsDrillDown(scope, metricsWindow);
  return (
    <AnalyticsPanel aria-label="Slow routes">
      <AnalyticsPanelHeader
        title="Slow routes"
        description={`Sorted by p95 · ${rangeLabel}`}
      />
      {items.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            title="No slow routes yet"
            message="Send `$request` events from the Node / Nest SDK middleware to see method, latency, and error rates by URL."
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border-t border-border">
            <Table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>URL / path</th>
                  <th className="text-right">Count</th>
                  <th className="hidden sm:table-cell text-right">p50</th>
                  <th className="text-right">p95</th>
                  <th className="text-right">Error rate</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const href = buildSlowRouteEventsHref(
                    row.method,
                    row.url,
                    eventsScope
                  );
                  return (
                    <tr key={`${row.method}:${row.url}`}>
                      <td className="font-mono text-[12px] tabular-nums">{row.method}</td>
                      <td>
                        <Link
                          href={href}
                          className="font-mono text-[12.5px] text-foreground underline-offset-4 hover:text-brand hover:underline"
                        >
                          {row.url}
                        </Link>
                        {row.smallSample ? <SmallSampleHint /> : null}
                      </td>
                      <td className="text-right tabular-nums">
                        {row.count.toLocaleString()}
                      </td>
                      <td className="hidden sm:table-cell text-right tabular-nums">
                        {formatDurationMs(row.p50Ms)}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {formatDurationMs(row.p95Ms)}
                      </td>
                      <td className="text-right tabular-nums">
                        {row.errorRatePct == null
                          ? "—"
                          : formatPct(row.errorRatePct, 1)}
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
