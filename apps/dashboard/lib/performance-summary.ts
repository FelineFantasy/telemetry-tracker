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
  p95: number | null;
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

/** Fetch performance summary KPIs for the dashboard performance page (#195). */
export async function fetchPerformanceSummary(
  search: URLSearchParams
): Promise<PerformancePageSummary | null> {
  const res = await dashboardApiFetch(`/api/performance/summary?${search.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as PerformancePageSummary;
}
