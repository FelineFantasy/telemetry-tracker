import { MetricCard, MetricCardGrid } from "@/app/components/dashboard/MetricCard";
import { formatCompact } from "@/lib/overview-format";

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

export function EventsSummaryMetrics({ summary }: { summary: EventsPageSummary }) {
  return (
    <section aria-label="Events summary metrics">
      <p className="mb-2.5 text-[12px] text-muted-foreground">
        {summary.window.label} · {summary.window.compareLabel}
      </p>
      <MetricCardGrid className="xl:grid-cols-4">
        <MetricCard
          label="Total events"
          value={formatCompact(summary.totalEvents)}
          current={summary.totalEvents}
          previous={summary.totalEventsPrevious}
          accent="event"
        />
        <MetricCard
          label="Distinct users"
          value={formatCompact(summary.distinctUsers)}
          current={summary.distinctUsers}
          previous={summary.distinctUsersPrevious}
          accent="neutral"
        />
        <MetricCard
          label="Unique event names"
          value={formatCompact(summary.uniqueEventNames)}
          current={summary.uniqueEventNames}
          previous={summary.uniqueEventNamesPrevious}
          accent="warning"
        />
        <MetricCard
          label="Distinct sessions"
          value={formatCompact(summary.distinctSessions)}
          current={summary.distinctSessions}
          previous={summary.distinctSessionsPrevious}
          accent="session"
        />
      </MetricCardGrid>
    </section>
  );
}
