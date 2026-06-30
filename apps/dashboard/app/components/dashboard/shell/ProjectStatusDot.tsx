import type { ProjectNavHealthStatus } from "@/lib/project-nav-summary-types";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<ProjectNavHealthStatus, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  outage: "bg-destructive",
  idle: "bg-muted-foreground/40",
};

const STATUS_LABEL: Record<ProjectNavHealthStatus, string> = {
  operational: "Healthy",
  degraded: "Elevated errors",
  outage: "Critical error rate",
  idle: "No recent telemetry",
};

export function ProjectStatusDot({
  status,
  className,
}: {
  status: ProjectNavHealthStatus;
  className?: string;
}) {
  return (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[status], className)}
      title={STATUS_LABEL[status]}
      aria-hidden
    />
  );
}

export function projectStatusLabel(status: ProjectNavHealthStatus): string {
  return STATUS_LABEL[status];
}
