import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared panel surface used across analytics pages (dashboard, issues, events, sessions, alerts). */
export const analyticsPanelClass =
  "overflow-hidden rounded-xl border border-border bg-surface/40";

export function AnalyticsPanel({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn(analyticsPanelClass, className)} {...props}>
      {children}
    </div>
  );
}

export function AnalyticsStatGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>
  );
}

export function AnalyticsMetricRow({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AnalyticsViewAllLink({
  href,
  children = "View all",
}: {
  href: string;
  children?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[13px] text-brand underline-offset-4 hover:underline"
    >
      {children} →
    </Link>
  );
}

export function AnalyticsPanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-border px-4 py-3 sm:px-5">{children}</div>
  );
}

export function AnalyticsSection({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <header>
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <AnalyticsPanel>
        {children}
        {footer ? <AnalyticsPanelFooter>{footer}</AnalyticsPanelFooter> : null}
      </AnalyticsPanel>
    </section>
  );
}

export function AnalyticsListShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

/** Dense row list inside a panel (mockup-style tables/lists). */
export function AnalyticsPanelList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border">{children}</ul>;
}

export function AnalyticsDetailLayout({
  main,
  sidebar,
}: {
  main: ReactNode;
  sidebar: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">{main}</div>
      <aside className="space-y-4">{sidebar}</aside>
    </div>
  );
}

export function AnalyticsSidebarPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <AnalyticsPanel>
      <AnalyticsPanelHeader title={title} />
      <div className="space-y-3 px-4 py-4 sm:px-5">{children}</div>
    </AnalyticsPanel>
  );
}

export function AnalyticsSidebarRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 text-[13px]">{children}</div>
    </div>
  );
}

export function IssueStatusBadge({ resolved }: { resolved: boolean }) {
  if (resolved) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
      Unresolved
    </span>
  );
}
