import Link from "next/link";
import type { OverviewActiveIssue } from "@/lib/overview-api";
import { DashboardPanel } from "@/app/components/dashboard/dashboard-ui";
import { EmptyState } from "@/app/components/EmptyState";

export function OverviewActiveIncidents({ issues }: { issues: OverviewActiveIssue[] }) {
  const p1 = issues.filter((i) => i.severity === "P1").length;
  const p3 = issues.filter((i) => i.severity === "P3").length;

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-1 border-b border-border/70 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Open issues</h2>
          <p className="text-[12px] text-muted-foreground">
            Unresolved error groups active in this period
          </p>
        </div>
        {issues.length > 0 ? (
          <span className="w-full rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-center text-[12px] font-medium text-destructive sm:w-auto sm:text-left">
            {p1} P1 · {p3} P3
          </span>
        ) : null}
      </div>
      {issues.length === 0 ? (
        <div className="px-4 py-5">
          <EmptyState
            title="No open issues"
            message="Unresolved error groups with activity in this range will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {issues.map((inc) => (
            <li key={inc.id}>
              <Link
                href={inc.href}
                className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-surface/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={inc.severity} />
                    <span className="min-w-0 line-clamp-1 break-all text-[13px] font-medium">
                      {inc.title}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-[12px] text-muted-foreground">{inc.meta}</p>
                </div>
                <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {inc.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

function SeverityBadge({ severity }: { severity: "P1" | "P3" }) {
  const cls =
    severity === "P1"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-warning/40 bg-warning/10 text-warning";
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${cls}`}>
      {severity}
    </span>
  );
}
