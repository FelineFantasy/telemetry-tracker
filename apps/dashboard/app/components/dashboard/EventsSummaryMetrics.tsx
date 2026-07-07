import {
  AnalyticsPanel,
} from "@/app/components/dashboard/analytics-ui";
import {
  calcDeltaPct,
  formatCompact,
  formatDeltaPct,
} from "@/lib/overview-format";

export type EventsPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  totalEvents: number;
  totalEventsPrevious: number;
  distinctUsers: number;
  distinctUsersPrevious: number;
  uniqueEventNames: number;
  uniqueEventNamesPrevious: number;
  distinctSessions: number;
  distinctSessionsPrevious: number;
};

function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
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
      <span aria-hidden>{arrow}</span> {delta.text}
    </p>
  );
}

function MetricCell({
  label,
  value,
  current,
  previous,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
}) {
  return (
    <div className="px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</p>
      <Delta current={current} previous={previous} />
    </div>
  );
}

export function EventsSummaryMetrics({ summary }: { summary: EventsPageSummary }) {
  return (
    <AnalyticsPanel aria-label="Events summary metrics">
      <div className="border-b border-border px-4 py-2 sm:px-5">
        <p className="text-[12px] text-muted-foreground">
          {summary.window.label} · {summary.window.compareLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 lg:divide-y-0">
        <MetricCell
          label="Total events"
          value={formatCompact(summary.totalEvents)}
          current={summary.totalEvents}
          previous={summary.totalEventsPrevious}
        />
        <MetricCell
          label="Distinct users"
          value={formatCompact(summary.distinctUsers)}
          current={summary.distinctUsers}
          previous={summary.distinctUsersPrevious}
        />
        <MetricCell
          label="Unique event names"
          value={formatCompact(summary.uniqueEventNames)}
          current={summary.uniqueEventNames}
          previous={summary.uniqueEventNamesPrevious}
        />
        <MetricCell
          label="Distinct sessions"
          value={formatCompact(summary.distinctSessions)}
          current={summary.distinctSessions}
          previous={summary.distinctSessionsPrevious}
        />
      </div>
    </AnalyticsPanel>
  );
}
