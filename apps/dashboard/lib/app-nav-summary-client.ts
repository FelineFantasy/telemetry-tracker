import { API_BASE_URL } from "@/lib/api-url";
import type { AppNavSummary } from "@/lib/app-nav-summary-types";

export async function fetchAppNavSummaries(
  projectId: string,
  organizationId: string | null
): Promise<Record<string, AppNavSummary>> {
  if (!projectId) return {};

  const headers: Record<string, string> = {
    "X-Project-Id": projectId,
  };
  if (organizationId) {
    headers["X-Organization-Id"] = organizationId;
  }

  const res = await fetch(`${API_BASE_URL}/api/apps/nav-summary`, {
    credentials: "include",
    headers,
    cache: "no-store",
  });

  if (!res.ok) return {};

  const data = (await res.json()) as { summaries?: AppNavSummary[] };
  const summaries = Array.isArray(data.summaries) ? data.summaries : [];
  return Object.fromEntries(summaries.map((s) => [s.app, s]));
}
