import type { ReactNode } from "react";
import { AnalyticsPanel, analyticsPanelClass } from "@/app/components/dashboard/analytics-ui";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "muted",
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: "success" | "danger" | "muted";
}) {
  const deltaClass =
    deltaTone === "success"
      ? "text-success"
      : deltaTone === "danger"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <AnalyticsPanel className="px-4 py-3.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {delta ? <p className={`mt-1 text-[12px] ${deltaClass}`}>{delta}</p> : null}
    </AnalyticsPanel>
  );
}

export function DashboardSection({
  kicker,
  title,
  description,
  children,
  className = "",
}: {
  kicker?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`}>
      <header>
        {kicker ? (
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {kicker}
          </p>
        ) : null}
        <h2 className={`text-base font-medium tracking-tight ${kicker ? "mt-0.5" : ""}`}>{title}</h2>
        {description ? <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function DashboardPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <AnalyticsPanel className={cn(className)}>{children}</AnalyticsPanel>;
}

export { analyticsPanelClass };
