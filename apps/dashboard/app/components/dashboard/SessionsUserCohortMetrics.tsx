"use client";

import {
  AnalyticsPanel,
  MetricDelta,
} from "@/app/components/dashboard/analytics-ui";
import { MetricHelp } from "@/app/components/dashboard/MetricHelp";
import {
  formatCompact,
  formatPct,
} from "@/lib/overview-format";
import type { SessionsPageSummary } from "@/app/components/dashboard/SessionsSummaryMetrics";

function CohortCell({
  label,
  count,
  sharePct,
  previousCount,
  help,
}: {
  label: string;
  count: number;
  sharePct: number;
  previousCount: number;
  help: string;
}) {
  return (
    <div className="px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex items-center gap-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <MetricHelp label={label}>{help}</MetricHelp>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
        {formatCompact(count)}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({formatPct(sharePct, 0)})
        </span>
      </p>
      <MetricDelta current={count} previous={previousCount} />
    </div>
  );
}

const NEW_USER_HELP =
  "Users whose first session in this project (for the current filters) started on or after the selected period start.";

const RETURNING_USER_HELP =
  "Users who were first seen before the selected period start and had at least one session during the period.";

export function SessionsUserCohortMetrics({
  summary,
}: {
  summary: SessionsPageSummary;
}) {
  const { userCohorts } = summary;
  return (
    <AnalyticsPanel aria-label="User cohort metrics">
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <CohortCell
          label="New users"
          count={userCohorts.newUsers}
          sharePct={userCohorts.newUsersPct}
          previousCount={userCohorts.newUsersPrevious}
          help={NEW_USER_HELP}
        />
        <CohortCell
          label="Returning users"
          count={userCohorts.returningUsers}
          sharePct={userCohorts.returningUsersPct}
          previousCount={userCohorts.returningUsersPrevious}
          help={RETURNING_USER_HELP}
        />
      </div>
    </AnalyticsPanel>
  );
}
