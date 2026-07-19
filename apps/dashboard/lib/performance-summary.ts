import { dashboardApiFetch } from "@/lib/dashboard-api";

export type PerformanceSparklinePoint = {
  t: string;
  value: number | null;
};

export type WebVitalRatingDistribution = {
  good: number;
  needsImprovement: number;
  poor: number;
  goodPct: number;
  needsImprovementPct: number;
  poorPct: number;
  total: number;
};

export type WebVitalMetricSummary = {
  metric: "LCP" | "INP" | "CLS" | "TTFB";
  sampleCount: number;
  p75: number | null;
  p75Previous: number | null;
  p95: number | null;
  goodPctPrevious: number | null;
  rating: WebVitalRatingDistribution;
  series: PerformanceSparklinePoint[];
};

export type PerformanceRequestLatency =
  | { available: false }
  | {
      available: true;
      avgMs: number;
      avgMsPrevious: number | null;
      p95Ms: number;
      p95MsPrevious: number | null;
      apdex: number;
      apdexPct: number;
      apdexPrevious: number | null;
      requestCount: number;
      series: {
        avgMs: PerformanceSparklinePoint[];
        p95Ms: PerformanceSparklinePoint[];
        apdexPct: PerformanceSparklinePoint[];
      };
    };

export type PerformancePageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  chartWindow: {
    since: string;
    until: string;
  };
  bucket: "hour" | "day" | "week";
  webVitals: {
    available: boolean;
    vitals: Record<"LCP" | "INP" | "CLS" | "TTFB", WebVitalMetricSummary>;
  };
  requestLatency: PerformanceRequestLatency;
};

export type SlowRouteRow = {
  method: string;
  url: string;
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  errorRatePct: number | null;
  smallSample: boolean;
};

export type SlowPageRow = {
  path: string;
  lcpP75: number | null;
  clsP75: number | null;
  sampleCount: number;
  smallSample: boolean;
};

export type SlowPathsListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  window: {
    since: string;
    until: string;
    label: string;
  };
};

/** Fetch performance summary KPIs for the dashboard performance page (#195). */
export async function fetchPerformanceSummary(
  search: URLSearchParams
): Promise<PerformancePageSummary | null> {
  const res = await dashboardApiFetch(`/api/performance/summary?${search.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as PerformancePageSummary;
}

/** Fetch slowest `$request` routes for the selected Performance scope (#196). */
export async function fetchSlowRoutes(
  search: URLSearchParams
): Promise<SlowPathsListResult<SlowRouteRow> | null> {
  const res = await dashboardApiFetch(
    `/api/performance/slow-routes?${search.toString()}`
  );
  if (!res.ok) return null;
  return (await res.json()) as SlowPathsListResult<SlowRouteRow>;
}

/** Fetch slowest pages from `$web_vital` LCP for the selected Performance scope (#196). */
export async function fetchSlowPages(
  search: URLSearchParams
): Promise<SlowPathsListResult<SlowPageRow> | null> {
  const res = await dashboardApiFetch(
    `/api/performance/slow-pages?${search.toString()}`
  );
  if (!res.ok) return null;
  return (await res.json()) as SlowPathsListResult<SlowPageRow>;
}
