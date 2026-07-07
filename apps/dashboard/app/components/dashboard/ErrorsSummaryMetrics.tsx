import {
  AnalyticsPanel,
} from "@/app/components/dashboard/analytics-ui";
import {
  calcDeltaPct,
  formatCompact,
  formatDeltaPct,
  formatPct,
} from "@/lib/overview-format";

export type ErrorsPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  totalOccurrences: number;
  totalOccurrencesPrevious: number;
  affectedUsers: number;
  affectedUsersPrevious: number;
  uniqueGroups: number;
  uniqueGroupsPrevious: number;
  resolvedGroups: number;
  resolvedGroupsPrevious: number;
  eventsCount: number;
  eventsCountPrevious: number;
  errorRatePct: number;
  errorRatePctPrevious: number;
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

function PpDelta({
  deltaPp,
  invert = false,
}: {
  deltaPp: number;
  invert?: boolean;
}) {
  const tone =
    Math.abs(deltaPp) < 0.05
      ? "flat"
      : deltaPp > 0
        ? "up"
        : "down";
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
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  invertDelta?: boolean;
  deltaMode?: "relative" | "pp";
}) {
  return (
    <div className="px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{value}</p>
      {deltaMode === "pp" ? (
        <PpDelta deltaPp={current - previous} invert={invertDelta} />
      ) : (
        <Delta current={current} previous={previous} invert={invertDelta} />
      )}
    </div>
  );
}

export function ErrorsSummaryMetrics({ summary }: { summary: ErrorsPageSummary }) {
  const errorRateDelta = summary.errorRatePct - summary.errorRatePctPrevious;

  return (
    <AnalyticsPanel aria-label="Errors summary metrics">
      <div className="border-b border-border px-4 py-2 sm:px-5">
        <p className="text-[12px] text-muted-foreground">
          {summary.window.label} · {summary.window.compareLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        <MetricCell
          label="Total errors"
          value={formatCompact(summary.totalOccurrences)}
          current={summary.totalOccurrences}
          previous={summary.totalOccurrencesPrevious}
          invertDelta
        />
        <MetricCell
          label="Affected users"
          value={formatCompact(summary.affectedUsers)}
          current={summary.affectedUsers}
          previous={summary.affectedUsersPrevious}
          invertDelta
        />
        <MetricCell
          label="Error rate"
          value={formatPct(summary.errorRatePct, 1)}
          current={summary.errorRatePct}
          previous={summary.errorRatePctPrevious}
          invertDelta
          deltaMode="pp"
        />
        <MetricCell
          label="Unique groups"
          value={formatCompact(summary.uniqueGroups)}
          current={summary.uniqueGroups}
          previous={summary.uniqueGroupsPrevious}
          invertDelta
        />
        <MetricCell
          label="Resolved groups"
          value={formatCompact(summary.resolvedGroups)}
          current={summary.resolvedGroups}
          previous={summary.resolvedGroupsPrevious}
        />
      </div>
      <div className="sr-only" aria-live="polite">
        Error rate change {errorRateDelta.toFixed(1)} percentage points
      </div>
    </AnalyticsPanel>
  );
}
