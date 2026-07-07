"use client";

import Link from "next/link";
import {
  AnalyticsPanel,
} from "@/app/components/dashboard/analytics-ui";
import {
  MiniSparkline,
  type SparklinePoint,
} from "@/app/components/dashboard/MiniSparkline";
import {
  calcDeltaPct,
  formatCompact,
  formatDeltaPct,
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

function Delta({
  current,
  previous,
  invert = false,
  compareText,
}: {
  current: number;
  previous: number;
  invert?: boolean;
  compareText: string;
}) {
  const delta = formatDeltaPct(calcDeltaPct(current, previous));
  const good =
    delta.tone === "flat"
      ? "text-muted-foreground"
      : delta.tone === "up"
        ? invert
          ? "text-destructive"
          : "text-success"
        : invert
          ? "text-success"
          : "text-destructive";
  const arrow = delta.tone === "up" ? "▲" : delta.tone === "down" ? "▼" : "—";
  return (
    <p className={`mt-1 text-[11px] ${good}`}>
      <span aria-hidden>{arrow}</span> {delta.text} {compareText}
    </p>
  );
}

function PpDelta({
  deltaPp,
  invert = false,
}: {
  deltaPp: number;
  invert?: boolean;
}) {
  const tone =
    Math.abs(deltaPp) < 0.05 ? "flat" : deltaPp > 0 ? "up" : "down";
  const good =
    tone === "flat"
      ? "text-muted-foreground"
      : tone === "up"
        ? invert
          ? "text-destructive"
          : "text-success"
        : invert
          ? "text-success"
          : "text-destructive";
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "—";
  const sign = deltaPp > 0 ? "+" : deltaPp < 0 ? "−" : "";
  const text =
    tone === "flat" ? "—" : `${sign}${Math.abs(deltaPp).toFixed(1)} pp`;
  return (
    <p className={`mt-1 text-[11px] ${good}`}>
      <span aria-hidden>{arrow}</span> {text}
    </p>
  );
}

function MetricCell({
  label,
  value,
  current,
  previous,
  invertDelta,
  deltaMode = "relative",
  sparkline,
  sparklineLabel,
  sparklineColor,
  compareText,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  invertDelta?: boolean;
  deltaMode?: "relative" | "pp";
  sparkline?: SparklinePoint[];
  sparklineLabel?: string;
  sparklineColor?: string;
  compareText: string;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</p>
        {deltaMode === "pp" ? (
          <PpDelta deltaPp={current - previous} invert={invertDelta} />
        ) : (
          <Delta
            current={current}
            previous={previous}
            invert={invertDelta}
            compareText={compareText}
          />
        )}
      </div>
      {sparkline && sparklineLabel ? (
        <MiniSparkline
          data={sparkline}
          color={sparklineColor}
          className="h-8 w-full max-w-[140px]"
          ariaLabel={sparklineLabel}
        />
      ) : null}
    </div>
  );
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
    <div className="rounded-lg border border-border bg-surface/30 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{detail}</p>
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
  const latencyAvailable = latencyMetrics !== undefined;
  const primaryCols = latencyAvailable
    ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Key metrics</h2>
          <p className="text-[12px] text-muted-foreground">
            {rangeLabel} · {compareLabel}
          </p>
        </div>
        <Link
          href="/dashboard/events"
          className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open events →
        </Link>
      </div>

      <AnalyticsPanel aria-label="Overview key metrics">
        <div className={`grid grid-cols-1 divide-y divide-border ${primaryCols} lg:divide-x lg:divide-y-0`}>
          <MetricCell
            label="Events"
            value={formatCompact(eventsCount)}
            current={eventsCount}
            previous={eventsPrevious}
            sparkline={sparklines.events}
            sparklineLabel="Events over time"
            sparklineColor="var(--chart-event, #60a5fa)"
            compareText={compareLabel}
          />
          <MetricCell
            label="Errors"
            value={formatCompact(errorsCount)}
            current={errorsCount}
            previous={errorsPrevious}
            invertDelta
            sparkline={sparklines.errors}
            sparklineLabel="Errors over time"
            sparklineColor="var(--chart-error, #f87171)"
            compareText={compareLabel}
          />
          <MetricCell
            label="Sessions"
            value={formatCompact(sessionsCount)}
            current={sessionsCount}
            previous={sessionsPrevious}
            sparkline={sparklines.sessions}
            sparklineLabel="Sessions over time"
            sparklineColor="var(--chart-session, #34d399)"
            compareText={compareLabel}
          />
          <MetricCell
            label="Active users"
            value={formatCompact(activeUsers)}
            current={activeUsers}
            previous={activeUsersPrevious}
            compareText={compareLabel}
          />
          {latencyMetrics ? (
            <>
              <MetricCell
                label="Avg response"
                value={formatDurationMs(latencyMetrics.avgResponseMs)}
                current={latencyMetrics.avgResponseMs}
                previous={latencyMetrics.avgResponseMsPrevious}
                invertDelta
                sparkline={latencyMetrics.sparklines.avgResponseMs}
                sparklineLabel="Average response time over time"
                sparklineColor="var(--chart-performance, #a78bfa)"
                compareText={compareLabel}
              />
              <MetricCell
                label="Apdex"
                value={formatApdex(latencyMetrics.apdex)}
                current={latencyMetrics.apdex * 100}
                previous={latencyMetrics.apdexPrevious * 100}
                deltaMode="pp"
                sparkline={latencyMetrics.sparklines.apdexPct}
                sparklineLabel="Apdex score over time"
                sparklineColor="var(--chart-performance, #a78bfa)"
                compareText={compareLabel}
              />
            </>
          ) : null}
        </div>
      </AnalyticsPanel>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          detail={`${rangeLabel} · rate ${formatRatePerSec(ingestRate)}`}
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
