import { coalesceApiRequest } from "@/lib/api-inflight";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import type { AppNavSummary } from "@/lib/app-nav-summary-types";

export async function fetchAppNavSummariesForLayout(
  projectId: string,
  organizationId: string | null
): Promise<Record<string, AppNavSummary>> {
  if (!projectId) return {};

  const key = `app-nav-summary:${projectId}:${organizationId ?? ""}`;
  return coalesceApiRequest(key, async () => {
    const res = await dashboardApiFetch("/api/apps/nav-summary", undefined, {
      projectIdOverride: projectId,
      ...(organizationId ? { organizationIdOverride: organizationId } : {}),
    });
    if (!res.ok) return {};

    const data = (await res.json()) as { summaries?: AppNavSummary[] };
    const summaries = Array.isArray(data.summaries) ? data.summaries : [];
    return Object.fromEntries(summaries.map((s) => [s.app, s]));
  });
}
