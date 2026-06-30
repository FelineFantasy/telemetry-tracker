import { API_BASE_URL } from "@/lib/api-url";
import type { ProjectNavSummary } from "@/lib/project-nav-summary-types";

export async function fetchProjectNavSummaries(
  organizationId: string | null
): Promise<Record<string, ProjectNavSummary>> {
  const headers: Record<string, string> = {};
  if (organizationId) {
    headers["X-Organization-Id"] = organizationId;
  }

  const res = await fetch(`${API_BASE_URL}/api/meta/projects/nav-summary`, {
    credentials: "include",
    headers,
    cache: "no-store",
  });

  if (!res.ok) return {};

  const data = (await res.json()) as { summaries?: ProjectNavSummary[] };
  const summaries = Array.isArray(data.summaries) ? data.summaries : [];
  return Object.fromEntries(summaries.map((s) => [s.projectId, s]));
}
