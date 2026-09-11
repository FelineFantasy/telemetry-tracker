import type { ReactNode } from "react";
import {
  AnalyticsPanel,
  MetricDelta,
} from "@/app/components/dashboard/analytics-ui";
import {
  MiniSparkline,
  type SparklinePoint,
} from "@/app/components/dashboard/MiniSparkline";
import { cn } from "@/lib/cn";

export type MetricCardAccent = "error" | "event" | "session" | "warning" | "success" | "neutral";

const ACCENT_BAR: Record<MetricCardAccent, string> = {
  error: "bg-destructive",
  event: "bg-[color:var(--chart-event)]",
  session: "bg-success",
  warning: "bg-warning",
  success: "bg-success",
  neutral: "bg-border",
};

const SPARKLINE_COLOR: Record<MetricCardAccent, string> = {
  error: "var(--chart-error, #f87171)",
  event: "var(--chart-event, #a78bfa)",
  session: "var(--chart-session, #34d399)",
  warning: "var(--warning)",
  success: "var(--success)",
  neutral: "var(--muted-foreground)",
};

export function MetricCardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 xl:grid-cols-5", className)}>
      {children}
    </div>
  );
}

export function MetricCard({
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
  title,
  help,
  accent = "neutral",
}: {
  label: string;
  value: string;
  current: number;
  previous: number | null;
  invertDelta?: boolean;
  deltaMode?: "relative" | "pp";
  sparkline?: SparklinePoint[];
  sparklineLabel?: string;
  sparklineColor?: string;
  compareText?: string;
  title?: string;
  help?: ReactNode;
  accent?: MetricCardAccent;
}) {
  return (
    <AnalyticsPanel className="relative px-4 py-3.5" title={title}>
      <span
        className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", ACCENT_BAR[accent])}
        aria-hidden
      />
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        {help}
      </div>
      <p className="mt-1 text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight">
        {value}
      </p>
      {previous == null ? (
        compareText ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">— {compareText}</p>
        ) : null
      ) : (
        <MetricDelta
          current={current}
          previous={previous}
          invert={invertDelta}
          mode={deltaMode}
          compareText={compareText}
        />
      )}
      {sparkline && sparklineLabel ? (
        <MiniSparkline
          data={sparkline}
          color={sparklineColor ?? SPARKLINE_COLOR[accent]}
          className="mt-2 h-8 w-full"
          ariaLabel={sparklineLabel}
        />
      ) : null}
    </AnalyticsPanel>
  );
}
