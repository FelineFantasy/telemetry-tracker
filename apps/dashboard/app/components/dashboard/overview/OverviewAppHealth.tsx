"use client";

import type { ReactNode } from "react";
import type { OverviewHealth } from "@/lib/overview-api";
import {
  formatPct,
  formatRatePerSec,
  formatSignedPct,
} from "@/lib/overview-format";
import { DashboardPanel } from "@/app/components/dashboard/dashboard-ui";
import { MetricHelp } from "@/app/components/dashboard/MetricHelp";

export function OverviewAppHealth({ health }: { health: OverviewHealth }) {
  const statusColor =
    health.status === "operational"
      ? "text-success"
      : health.status === "degraded"
        ? "text-warning"
        : "text-destructive";
  const dotColor =
    health.status === "operational"
      ? "bg-success"
      : health.status === "degraded"
        ? "bg-warning"
        : "bg-destructive";
  const errorDeltaClass =
    health.errorRateDeltaPct <= 0 ? "text-success" : "text-destructive";

  return (
    <DashboardPanel className="mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            App health
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusColor}`}>
              <span className="relative flex h-2 w-2">
                <span className={`absolute inset-0 animate-pulse-dot rounded-full opacity-40 ${dotColor}`} />
                <span className={`relative h-2 w-2 rounded-full ${dotColor}`} />
              </span>
              {health.statusLabel}
            </span>
            <span className="text-sm text-muted-foreground">{health.subtitle}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HealthMetric
          label="Telemetry success"
          title="SDK events as a percentage of total ingest (events + errors) in the selected period."
          value={formatPct(health.successRatePct)}
          detail="Events share of ingest volume"
          help={
            <>
              Percentage of ingest rows that are SDK events (not error occurrences). Higher is
              normal when your app is healthy.
            </>
          }
        />
        <HealthMetric
          label="Error rate"
          title="Error occurrences as a percentage of total ingest in the selected period."
          value={formatPct(health.errorRatePct)}
          detail={`${formatSignedPct(health.errorRateDeltaPct)} vs comparison window`}
          detailClassName={errorDeltaClass}
          help={
            <>
              Errors divided by events plus errors. The delta compares this rate to the previous
              comparison window (same length, immediately before).
            </>
          }
        />
        <HealthMetric
          label="Event throughput"
          title="Average SDK events per second across chart buckets in the selected period."
          value={formatRatePerSec(health.throughputPerSec)}
          detail={`peak ${formatRatePerSec(health.peakThroughputPerSec)}`}
          help={
            <>Average and peak event rate derived from the overview time-series buckets.</>
          }
        />
      </div>
    </DashboardPanel>
  );
}

function HealthMetric({
  label,
  title,
  value,
  detail,
  detailClassName = "text-muted-foreground",
  help,
}: {
  label: string;
  title: string;
  value: string;
  detail: string;
  detailClassName?: string;
  help?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-[12px] text-muted-foreground" title={title}>
          {label}
        </p>
        {help ? <MetricHelp label={label}>{help}</MetricHelp> : null}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className={`mt-0.5 text-[12px] ${detailClassName}`}>{detail}</p>
    </div>
  );
}
