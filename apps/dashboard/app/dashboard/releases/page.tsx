import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { ReleasesListToolbar } from "@/app/components/dashboard/ReleasesListToolbar";
import { ReleasesTable } from "@/app/components/dashboard/ReleasesTable";
import { AnalyticsListShell } from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { fetchReleasesSummary } from "@/lib/releases-summary";
import { redirectHrefIfMissingTimeRange, redirectHrefForMetricsUntil } from "@/lib/list-filters-url";
import {
  appendListTimeRangeToParams,
  isUnselectedTimeRange,
  parseListTimeRangeOrDefault,
  resolveMetricsUntilIso,
} from "@/lib/time-range";
import { firstQueryValue } from "@/lib/search-params";
import type { DashboardListScope } from "@/lib/overview-scope-url";

const RELEASES_PATH = "/dashboard/releases";

async function getFilterOptions(app?: string) {
  const p = new URLSearchParams();
  if (app) p.set("app", app);
  const res = await dashboardApiFetch(`/api/filter-options?${p.toString()}`);
  if (!res.ok) {
    return {
      environments: [] as string[],
      platforms: [] as string[],
    };
  }
  const data = (await res.json()) as {
    environments?: string[];
    platforms?: string[];
  };
  return {
    environments: data.environments ?? [],
    platforms: data.platforms ?? [],
  };
}

function buildReleasesParamsRecord(sp: Record<string, string | string[] | undefined>) {
  const keys = [
    "app",
    "range",
    "from",
    "to",
    "metricsUntil",
    "environment",
    "platform",
    "sort",
    "order",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export default async function ReleasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  let currentParams = buildReleasesParamsRecord(sp);
  const defaultTimeHref = redirectHrefIfMissingTimeRange(RELEASES_PATH, currentParams);
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

  const sort = firstQueryValue(sp.sort) ?? "recency";
  const order = firstQueryValue(sp.order) ?? "desc";
  const platform = firstQueryValue(sp.platform);
  const environment = firstQueryValue(sp.environment);

  const apiQuery = new URLSearchParams();
  if (appFilter) apiQuery.set("app", appFilter);
  appendListTimeRangeToParams(apiQuery, timeRange, from, to);
  if (platform) apiQuery.set("platform", platform);
  if (environment) apiQuery.set("environment", environment);
  apiQuery.set("sort", sort);
  apiQuery.set("order", order);

  const pageAnchorIso = isUnselectedTimeRange(timeRange.key)
    ? resolveMetricsUntilIso(firstQueryValue(sp.metricsUntil))
    : null;
  const metricsUntilHref = redirectHrefForMetricsUntil(
    RELEASES_PATH,
    currentParams,
    timeRange.key,
    pageAnchorIso
  );
  if (metricsUntilHref) redirect(metricsUntilHref);
  if (pageAnchorIso) {
    apiQuery.set("metricsUntil", pageAnchorIso);
    currentParams = { ...currentParams, metricsUntil: pageAnchorIso };
  } else if (currentParams.metricsUntil) {
    const { metricsUntil: _stale, ...withoutMetricsUntil } = currentParams;
    currentParams = withoutMetricsUntil;
  }

  let summary: Awaited<ReturnType<typeof fetchReleasesSummary>> = null;
  let environments: string[] = [];
  let platforms: string[] = [];

  try {
    const [summaryData, opts] = await Promise.all([
      fetchReleasesSummary(apiQuery),
      getFilterOptions(appFilter || undefined),
    ]);
    summary = summaryData;
    environments = opts.environments;
    platforms = opts.platforms;
  } catch (e) {
    return (
      <>
        <PageTitle title="Releases" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  if (!summary) {
    return (
      <>
        <PageTitle title="Releases" />
        <ErrorState message="Could not load release health summary." />
      </>
    );
  }

  const metricsRangeLabel = summary.window.label;
  const listScope: DashboardListScope = {
    app: appFilter || null,
    environment: environment || null,
    platform: platform || null,
    range: firstQueryValue(sp.range) ?? null,
    from: from || null,
    to: to || null,
    ...(pageAnchorIso ? { metricsUntil: pageAnchorIso } : {}),
  };

  return (
    <>
      <PageTitle
        title="Releases"
        context={
          appFilter
            ? `${metricsRangeLabel} · App: ${appFilter}`
            : `${metricsRangeLabel} · Adoption and regressions across versions.`
        }
      />

      <AnalyticsListShell>
        <ReleasesListToolbar
          path={RELEASES_PATH}
          currentParams={currentParams}
          timeRange={timeRange}
          fromParam={from}
          toParam={to}
          appFilter={appFilter}
          environment={environment ?? ""}
          platform={platform ?? ""}
          sort={sort}
          order={order}
          environments={environments}
          platforms={platforms}
        />

        {summary.items.length === 0 ? (
          <EmptyState
            title="No releases yet"
            message="Ingest events, errors, or sessions with a release label to see adoption and health here."
          />
        ) : (
          <ReleasesTable items={summary.items} scope={listScope} />
        )}
      </AnalyticsListShell>
    </>
  );
}
