"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  compareLabelFor,
  mergeOverviewScopeQuery,
  parseOverviewCompare,
  type OverviewCompareParam,
} from "@/lib/overview-scope-url";
import { OverviewKeyMetrics } from "@/app/components/dashboard/overview/OverviewKeyMetrics";
import type {
  OverviewWorkspaceStats,
  OverviewWorkspaceTelemetry,
} from "@/lib/overview-api";

export function OverviewCompareToggle({
  value,
  overviewPath,
  currentParams,
}: {
  value: OverviewCompareParam;
  overviewPath: string;
  currentParams: Record<string, string>;
}) {
  const router = useRouter();

  function setCompare(next: OverviewCompareParam) {
    router.push(
      mergeOverviewScopeQuery(overviewPath, currentParams, {
        compare: next === "previous" ? null : next,
      })
    );
  }

  return (
    <div className="mb-4 inline-flex rounded-md border border-border p-0.5">
      <button
        type="button"
        className={`rounded px-2.5 py-1 text-[12px] ${
          value === "previous" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
        }`}
        onClick={() => setCompare("previous")}
      >
        vs previous period
      </button>
      <button
        type="button"
        className={`rounded px-2.5 py-1 text-[12px] ${
          value === "week-ago" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
        }`}
        onClick={() => setCompare("week-ago")}
      >
        vs last week
      </button>
    </div>
  );
}

export function OverviewMetricsSection({
  rangeLabel,
  rangeDurationMs,
  overviewPath,
  currentParams,
  eventsCount,
  eventsPrevious,
  errorsCount,
  errorsPrevious,
  sessionsCount,
  sessionsPrevious,
  activeUsers,
  activeUsersPrevious,
  workspaceStats,
  workspaceTelemetry,
}: {
  rangeLabel: string;
  rangeDurationMs: number;
  overviewPath: string;
  currentParams: Record<string, string>;
  eventsCount: number;
  eventsPrevious: number;
  errorsCount: number;
  errorsPrevious: number;
  sessionsCount: number;
  sessionsPrevious: number;
  activeUsers: number;
  activeUsersPrevious: number;
  workspaceStats: OverviewWorkspaceStats;
  workspaceTelemetry: OverviewWorkspaceTelemetry;
}) {
  const searchParams = useSearchParams();
  const compare = parseOverviewCompare(searchParams.get("compare") ?? currentParams.compare);
  const compareLabel = compareLabelFor(compare, rangeLabel);

  return (
    <>
      <OverviewCompareToggle
        value={compare}
        overviewPath={overviewPath}
        currentParams={currentParams}
      />
      <OverviewKeyMetrics
        eventsCount={eventsCount}
        eventsPrevious={eventsPrevious}
        errorsCount={errorsCount}
        errorsPrevious={errorsPrevious}
        sessionsCount={sessionsCount}
        sessionsPrevious={sessionsPrevious}
        activeUsers={activeUsers}
        activeUsersPrevious={activeUsersPrevious}
        workspaceStats={workspaceStats}
        workspaceTelemetry={workspaceTelemetry}
        rangeLabel={rangeLabel}
        compareLabel={compareLabel}
        rangeDurationMs={rangeDurationMs}
      />
    </>
  );
}
