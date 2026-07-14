import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { PerformanceListToolbar } from "@/app/components/dashboard/PerformanceListToolbar";
import { PerformanceRatingDistribution } from "@/app/components/dashboard/PerformanceRatingDistribution";
import { PerformanceSummaryMetrics } from "@/app/components/dashboard/PerformanceSummaryMetrics";
import { PerformanceVitalsChart } from "@/app/components/dashboard/PerformanceVitalsChart";
import { AnalyticsListShell } from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { fetchPerformanceSummary } from "@/lib/performance-summary";
import { redirectHrefIfMissingTimeRange } from "@/lib/list-filters-url";
import { appendListTimeRangeToParams, isUnselectedTimeRange, parseListTimeRangeOrDefault } from "@/lib/time-range";
import { firstQueryValue } from "@/lib/search-params";

const PERFORMANCE_PATH = "/dashboard/performance";

async function getFilterOptions(app?: string) {
  const p = new URLSearchParams();
  if (app) p.set("app", app);
  const res = await dashboardApiFetch(`/api/filter-options?${p.toString()}`);
  if (!res.ok) {
    return {
      environments: [] as string[],
      platforms: [] as string[],
      releases: [] as string[],
    };
  }
  const data = (await res.json()) as {
    environments?: string[];
    platforms?: string[];
    releases?: string[];
  };
  return {
    environments: data.environments ?? [],
    platforms: data.platforms ?? [],
    releases: data.releases ?? [],
  };
}

function buildPerformanceParamsRecord(sp: Record<string, string | string[] | undefined>) {
  const keys = [
    "app",
    "range",
    "from",
    "to",
    "environment",
    "platform",
    "release",
    "chartBucket",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

function chartRangeLabel(summary: NonNullable<Awaited<ReturnType<typeof fetchPerformanceSummary>>>): string {
  const chartSinceMs = new Date(summary.chartWindow.since).getTime();
  const windowSinceMs = new Date(summary.window.since).getTime();
  if (chartSinceMs <= windowSinceMs) {
    return summary.window.label;
  }
  return `${summary.window.label} (recent chart)`;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const currentParams = buildPerformanceParamsRecord(sp);
  const defaultTimeHref = redirectHrefIfMissingTimeRange(PERFORMANCE_PATH, currentParams);
  if (defaultTimeHref) redirect(defaultTimeHref);
  const appFilter = firstQueryValue(sp.app) ?? "";
  const from = firstQueryValue(sp.from) ?? "";
  const to = firstQueryValue(sp.to) ?? "";
  const timeRange = parseListTimeRangeOrDefault(
    {
      range: firstQueryValue(sp.range),
      from: from || undefined,
      to: to || undefined,
    },
    "all"
  );

  const apiQuery = new URLSearchParams();
  if (appFilter) apiQuery.set("app", appFilter);
  appendListTimeRangeToParams(apiQuery, timeRange, from, to);
  const platform = firstQueryValue(sp.platform);
  const environment = firstQueryValue(sp.environment);
  const release = firstQueryValue(sp.release);
  const chartBucket = firstQueryValue(sp.chartBucket);
  if (platform) apiQuery.set("platform", platform);
  if (environment) apiQuery.set("environment", environment);
  if (release) apiQuery.set("release", release);
  if (chartBucket) apiQuery.set("chartBucket", chartBucket);

  const pageAnchor = new Date();
  if (isUnselectedTimeRange(timeRange.key)) {
    apiQuery.set("metricsUntil", pageAnchor.toISOString());
  }

  let summary: Awaited<ReturnType<typeof fetchPerformanceSummary>> = null;
  let environments: string[] = [];
  let platforms: string[] = [];
  let releases: string[] = [];

  try {
    const [summaryData, opts] = await Promise.all([
      fetchPerformanceSummary(apiQuery),
      getFilterOptions(appFilter || undefined),
    ]);
    summary = summaryData;
    environments = opts.environments;
    platforms = opts.platforms;
    releases = opts.releases;
  } catch (e) {
    return (
      <>
        <PageTitle title="Performance" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const metricsRangeLabel = summary?.window.label ?? timeRange.label;
  const hasVitals = summary?.webVitals.available === true;
  const hasRequestLatency = summary?.requestLatency.available === true;

  return (
    <>
      <PageTitle
        title="Performance"
        context={
          appFilter
            ? `${metricsRangeLabel} · App: ${appFilter}`
            : `${metricsRangeLabel} · Web vitals and request latency for your apps.`
        }
      />

      <AnalyticsListShell>
        <PerformanceListToolbar
          path={PERFORMANCE_PATH}
          currentParams={currentParams}
          timeRange={timeRange}
          fromParam={from}
          toParam={to}
          appFilter={appFilter}
          environment={environment ?? ""}
          platform={platform ?? ""}
          release={release ?? ""}
          chartBucket={chartBucket ?? ""}
          environments={environments}
          platforms={platforms}
          releases={releases}
        />

        {!summary ? (
          <ErrorState message="Could not load performance summary." />
        ) : hasVitals || hasRequestLatency ? (
          <>
            <PerformanceSummaryMetrics summary={summary} />
            {hasVitals ? (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <PerformanceVitalsChart
                  summary={summary}
                  rangeLabel={chartRangeLabel(summary)}
                  path={PERFORMANCE_PATH}
                  currentParams={currentParams}
                />
                <PerformanceRatingDistribution
                  summary={summary}
                  rangeLabel={summary.window.label}
                />
              </section>
            ) : (
              <EmptyState
                title="No web vitals yet"
                message="Send `$web_vital` events from the Telemetry SDK (browser or supported runtimes) to see LCP, INP, CLS, and TTFB here. Request latency metrics are shown above from `$request` events."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="No performance data yet"
            message="Enable web vitals in your SDK to capture LCP, INP, CLS, and TTFB, or instrument server `$request` events for response-time metrics."
          />
        )}
      </AnalyticsListShell>
    </>
  );
}
