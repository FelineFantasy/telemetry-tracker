import { coalesceApiRequest } from "@/lib/api-inflight";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import type { ProjectNavSummary } from "@/lib/project-nav-summary-types";

export async function fetchProjectNavSummariesForLayout(
  organizationId: string | null
): Promise<Record<string, ProjectNavSummary>> {
  const key = `project-nav-summary:${organizationId ?? ""}`;
  return coalesceApiRequest(key, async () => {
    const res = await dashboardApiFetch("/api/meta/projects/nav-summary", undefined, {
      omitProjectHeader: true,
      ...(organizationId ? { organizationIdOverride: organizationId } : {}),
    });
    if (!res.ok) return {};

    const data = (await res.json()) as { summaries?: ProjectNavSummary[] };
    const summaries = Array.isArray(data.summaries) ? data.summaries : [];
    return Object.fromEntries(summaries.map((s) => [s.projectId, s]));
  });
}
