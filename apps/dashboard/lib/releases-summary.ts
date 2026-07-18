import { dashboardApiFetch } from "@/lib/dashboard-api";

export type ReleaseVsPrevious = {
  errorRatePp: number | null;
  sessionsPct: number | null;
  errorsPct: number | null;
};

export type ReleaseHealthRow = {
  release: string | null;
  releaseKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessions: number;
  activeUsers: number;
  events: number;
  errors: number;
  errorRatePct: number | null;
  adoptionSharePct: number;
  previousReleaseKey: string | null;
  vsPrevious: ReleaseVsPrevious | null;
};

export type ReleasesPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  scope: {
    app?: string;
    environment?: string;
    platform?: string;
  };
  totals: {
    sessions: number;
    events: number;
    errors: number;
  };
  items: ReleaseHealthRow[];
  sort: "recency" | "adoption" | "errors" | "error_rate";
  order: "asc" | "desc";
};

/** Fetch release health KPIs for the dashboard Releases page (#453). */
export async function fetchReleasesSummary(
  search: URLSearchParams
): Promise<ReleasesPageSummary | null> {
  const res = await dashboardApiFetch(`/api/releases/summary?${search.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as ReleasesPageSummary;
}
