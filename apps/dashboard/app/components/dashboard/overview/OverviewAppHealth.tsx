import type { OverviewHealth } from "@/lib/overview-api";
import {
  formatPct,
  formatRatePerSec,
  formatSignedPct,
} from "@/lib/overview-format";
import { DashboardPanel } from "@/app/components/dashboard/dashboard-ui";

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthMetric
          label="Telemetry success"
          value={formatPct(health.successRatePct)}
          detail="Events share of ingest volume"
        />
        <HealthMetric
          label="Error rate"
          value={formatPct(health.errorRatePct)}
          detail={`${formatSignedPct(health.errorRateDeltaPct)} vs comparison window`}
          detailClassName={errorDeltaClass}
        />
        <HealthMetric
          label="Event throughput"
          value={formatRatePerSec(health.throughputPerSec)}
          detail={`peak ${formatRatePerSec(health.peakThroughputPerSec)}`}
        />
        <HealthMetric
          label="Ingest mix"
          value={formatPct(health.errorRatePct, 1)}
          detail="Errors as % of total ingest"
        />
      </div>
    </DashboardPanel>
  );
}

function HealthMetric({
  label,
  value,
  detail,
  detailClassName = "text-muted-foreground",
}: {
  label: string;
  value: string;
  detail: string;
  detailClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-4 py-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className={`mt-0.5 text-[12px] ${detailClassName}`}>{detail}</p>
    </div>
  );
}
