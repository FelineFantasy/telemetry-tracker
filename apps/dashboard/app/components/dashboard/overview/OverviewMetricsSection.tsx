"use client";

import { useSearchParams } from "next/navigation";
import {
  compareLabelFor,
  parseOverviewCompare,
} from "@/lib/overview-scope-url";
import { CompareModeControl } from "@/app/components/dashboard/CompareModeControl";
import { OverviewKeyMetrics } from "@/app/components/dashboard/overview/OverviewKeyMetrics";
import type {
  OverviewKpiSparklines,
  OverviewRequestMetrics,
  OverviewWorkspaceStats,
  OverviewWorkspaceTelemetry,
} from "@/lib/overview-api";

export { CompareModeControl as OverviewCompareToggle } from "@/app/components/dashboard/CompareModeControl";

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
  sparklines,
  requestMetrics,
  compareLabel: compareLabelProp,
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
  sparklines: OverviewKpiSparklines;
  requestMetrics?: OverviewRequestMetrics;
  compareLabel?: string;
}) {
  const searchParams = useSearchParams();
  const compare = parseOverviewCompare(
    searchParams.get("compare") ?? currentParams.compare
  );
  const compareLabel =
    compareLabelProp ?? compareLabelFor(compare, rangeLabel);

  return (
    <>
      <CompareModeControl
        path={overviewPath}
        currentParams={currentParams}
        value={compare}
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
        sparklines={sparklines}
        requestMetrics={requestMetrics}
      />
    </>
  );
}
