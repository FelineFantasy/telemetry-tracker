import Link from "next/link";
import {
  calcDeltaPct,
  formatCompact,
  formatDeltaPct,
  formatRatePerSec,
} from "@/lib/overview-format";
import type {
  OverviewWorkspaceStats,
  OverviewWorkspaceTelemetry,
} from "@/lib/overview-api";
import { DashboardPanel } from "@/app/components/dashboard/dashboard-ui";

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
};

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
}: Props) {
  const metrics = [
    {
      label: "Events",
      value: formatCompact(eventsCount),
      delta: formatDeltaPct(calcDeltaPct(eventsCount, eventsPrevious)),
      invertDelta: false,
    },
    {
      label: "Errors",
      value: formatCompact(errorsCount),
      delta: formatDeltaPct(calcDeltaPct(errorsCount, errorsPrevious)),
      invertDelta: true,
    },
    {
      label: "Sessions",
      value: formatCompact(sessionsCount),
      delta: formatDeltaPct(calcDeltaPct(sessionsCount, sessionsPrevious)),
      invertDelta: false,
    },
    {
      label: "Active users",
      value: formatCompact(activeUsers),
      delta: formatDeltaPct(calcDeltaPct(activeUsers, activeUsersPrevious)),
      invertDelta: false,
    },
  ];

  const ingestRate =
    rangeLabel === "7d"
      ? workspaceTelemetry.ingestRequests / (7 * 86400)
      : workspaceTelemetry.ingestRequests / 86400;

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Key metrics</h2>
          <p className="text-[12px] text-muted-foreground">{compareLabel}</p>
        </div>
        <Link
          href="/dashboard/events"
          className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open events →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricTile key={m.label} {...m} compareLabel={compareLabel} />
        ))}
      </div>

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

function MetricTile({
  label,
  value,
  delta,
  invertDelta,
  compareLabel,
}: {
  label: string;
  value: string;
  delta: ReturnType<typeof formatDeltaPct>;
  invertDelta: boolean;
  compareLabel: string;
}) {
  const good =
    delta.tone === "flat"
      ? "text-muted-foreground"
      : delta.tone === "up"
        ? invertDelta
          ? "text-destructive"
          : "text-success"
        : invertDelta
          ? "text-success"
          : "text-destructive";

  const arrow = delta.tone === "up" ? "▲" : delta.tone === "down" ? "▼" : "—";

  return (
    <DashboardPanel className="p-4">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className={`mt-1 text-[12px] ${good}`}>
        <span aria-hidden>{arrow}</span> {delta.text} {compareLabel}
      </p>
    </DashboardPanel>
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
