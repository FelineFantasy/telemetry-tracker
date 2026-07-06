import Link from "next/link";
import type { OverviewActiveIssue } from "@/lib/overview-api";
import { DashboardPanel } from "@/app/components/dashboard/dashboard-ui";
import { EmptyState } from "@/app/components/EmptyState";

export function OverviewActiveIncidents({ issues }: { issues: OverviewActiveIssue[] }) {
  const p1 = issues.filter((i) => i.severity === "P1").length;
  const p3 = issues.filter((i) => i.severity === "P3").length;

  return (
    <DashboardPanel className="mb-6">
      <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Open issues</h2>
          <p className="text-[12px] text-muted-foreground">
            Unresolved error groups active in this period
          </p>
        </div>
        {issues.length > 0 ? (
          <span className="w-full rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-center text-[12px] font-medium text-destructive sm:w-auto sm:py-0.5 sm:text-left">
            {p1} P1 · {p3} P3
          </span>
        ) : null}
      </div>
      {issues.length === 0 ? (
        <div className="px-5 py-6">
          <EmptyState
            title="No open issues"
            message="Unresolved error groups with activity in this range will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {issues.map((inc) => (
            <li key={inc.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-2">
                  <SeverityBadge severity={inc.severity} />
                  <Link
                    href={inc.href}
                    className="min-w-0 flex-1 line-clamp-2 break-all text-[13px] font-medium hover:underline"
                  >
                    {inc.title}
                  </Link>
                </div>
                <p className="mt-1 break-words text-[12px] text-muted-foreground">{inc.meta}</p>
              </div>
              <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {inc.status}
              </span>
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
