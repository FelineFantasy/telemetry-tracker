"use client";

import Link from "next/link";
import { MetricHelp } from "@/app/components/dashboard/MetricHelp";
import { MetricCard, MetricCardGrid } from "@/app/components/dashboard/MetricCard";
import {
  formatCompact,
  formatPct,
  formatRatePerSec,
} from "@/lib/overview-format";
import type {
  OverviewKpiSparklines,
  OverviewRequestMetrics,
  OverviewWorkspaceStats,
  OverviewWorkspaceTelemetry,
} from "@/lib/overview-api";

type Props = {
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
  rangeLabel: string;
  compareLabel: string;
  rangeDurationMs: number;
  sparklines: OverviewKpiSparklines;
  requestMetrics?: OverviewRequestMetrics;
};

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatApdex(score: number): string {
  return formatPct(score * 100, 1);
}

function OrgStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface/30 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

export function OverviewKeyMetrics({
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
  rangeLabel,
  compareLabel,
  rangeDurationMs,
  sparklines,
  requestMetrics,
}: Props) {
  const ingestRate =
    rangeDurationMs > 0
      ? workspaceTelemetry.ingestRequests / (rangeDurationMs / 1000)
      : 0;

  const latencyMetrics =
    requestMetrics?.available === true ? requestMetrics : undefined;
  const gridClass = latencyMetrics
    ? "lg:grid-cols-3 xl:grid-cols-6"
    : "lg:grid-cols-4 xl:grid-cols-4";

  return (
    <section className="mb-5">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">
          {rangeLabel} · {compareLabel}
        </p>
        <Link
          href="/dashboard/events"
          className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open events →
        </Link>
      </div>

      <MetricCardGrid className={gridClass}>
        <MetricCard
          label="Errors"
          title="Count of error occurrences ingested in the selected time range."
          help={
            <MetricHelp label="Errors">
              Each row is one captured exception or error report. The delta compares to{" "}
              {compareLabel}; down is good.
            </MetricHelp>
          }
          value={formatCompact(errorsCount)}
          current={errorsCount}
          previous={errorsPrevious}
          invertDelta
          sparkline={sparklines.errors}
          sparklineLabel="Errors over time"
          compareText={compareLabel}
          accent="error"
        />
        <MetricCard
          label="Events"
          title="Count of SDK events ingested in the selected time range."
          help={
            <MetricHelp label="Events">
              Custom events and automatic SDK events. Filtered by app and environment when set.
              The ▲/▼ percentage is the change versus {compareLabel}.
            </MetricHelp>
          }
          value={formatCompact(eventsCount)}
          current={eventsCount}
          previous={eventsPrevious}
          sparkline={sparklines.events}
          sparklineLabel="Events over time"
          compareText={compareLabel}
          accent="event"
        />
        <MetricCard
          label="Sessions"
          title="Count of user visits (session start markers) that began in the selected period."
          help={
            <MetricHelp label="Sessions">
              A session is one browser or app visit from SDK init until tab close or navigation
              away. Not the same as active users.
            </MetricHelp>
          }
          value={formatCompact(sessionsCount)}
          current={sessionsCount}
          previous={sessionsPrevious}
          sparkline={sparklines.sessions}
          sparklineLabel="Sessions over time"
          compareText={compareLabel}
          accent="session"
        />
        <MetricCard
          label="Active users"
          title="Distinct users with at least one event in the selected period."
          help={
            <MetricHelp label="Active users">
              Counts unique identities using user_id when present, otherwise anonymous_id. Based
              on events, not session rows. Compared to {compareLabel}.
            </MetricHelp>
          }
          value={formatCompact(activeUsers)}
          current={activeUsers}
          previous={activeUsersPrevious}
          compareText={compareLabel}
          accent="neutral"
        />
        {latencyMetrics ? (
          <>
            <MetricCard
              label="Avg response"
              value={formatDurationMs(latencyMetrics.avgResponseMs)}
              current={latencyMetrics.avgResponseMs}
              previous={latencyMetrics.avgResponseMsPrevious}
              invertDelta
              sparkline={latencyMetrics.sparklines.avgResponseMs}
              sparklineLabel="Average response time over time"
              compareText={compareLabel}
              accent="warning"
            />
            <MetricCard
              label="Apdex"
              value={formatApdex(latencyMetrics.apdex)}
              current={latencyMetrics.apdex * 100}
              previous={
                latencyMetrics.apdexPrevious == null
                  ? null
                  : latencyMetrics.apdexPrevious * 100
              }
              deltaMode="pp"
              sparkline={latencyMetrics.sparklines.apdexPct}
              sparklineLabel="Apdex score over time"
              compareText={compareLabel}
              accent="warning"
            />
          </>
        ) : null}
      </MetricCardGrid>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <OrgStat
          label="Projects"
          value={String(workspaceStats.projects.count)}
          detail={workspaceStats.projects.detail}
        />
        <OrgStat
          label="Organizations"
          value={String(workspaceStats.organizations.count)}
          detail={workspaceStats.organizations.detail}
        />
        <OrgStat
          label="Ingest requests"
          value={formatCompact(workspaceTelemetry.ingestRequests)}
          detail={`${rangeLabel} · ${formatRatePerSec(ingestRate)}`}
        />
        <OrgStat
          label="SDK events"
          value={formatCompact(workspaceTelemetry.sdkEventRows)}
          detail={`${workspaceTelemetry.distinctApps} apps · ${workspaceTelemetry.distinctSdkVersions} SDK versions`}
        />
      </div>
    </section>
  );
}
