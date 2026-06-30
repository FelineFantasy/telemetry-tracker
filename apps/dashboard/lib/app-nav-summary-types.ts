import type { ProjectNavHealthStatus } from "@/lib/project-nav-summary-types";

export type AppNavSummary = {
  app: string;
  status: ProjectNavHealthStatus;
  primaryEnvironment: string | null;
};
