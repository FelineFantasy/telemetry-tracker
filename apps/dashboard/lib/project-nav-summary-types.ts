export type ProjectNavHealthStatus = "operational" | "degraded" | "outage" | "idle";

export type ProjectNavSummary = {
  projectId: string;
  status: ProjectNavHealthStatus;
  primaryEnvironment: string | null;
};
