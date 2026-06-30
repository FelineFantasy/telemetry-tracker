import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Badge } from "@/app/components/Badge";
import { EmptyState } from "@/app/components/EmptyState";
import { TimeAgo } from "@/app/components/TimeAgo";
import { ErrorState } from "@/app/components/ErrorState";
import { OverviewTopBars } from "@/app/components/dashboard/OverviewTopBars";
import {
  mapErrorGroupsToBarRows,
  mapTopEventsToBarRows,
} from "@/lib/overview-bar-rows";
import { OverviewSortControls } from "@/app/components/dashboard/OverviewSortControls";
import { OverviewTrendsChart } from "@/app/components/dashboard/OverviewTrendsChart";
import { RangeTabs } from "@/app/components/dashboard/RangeTabs";
import { Pagination } from "@/app/components/ui/Pagination";
import { DashboardSection, StatCard } from "@/app/components/dashboard/dashboard-ui";
import { IssueList, OverviewListItem } from "@/app/components/dashboard/IssueList";
import { OverviewGreeting } from "@/app/components/dashboard/overview/OverviewGreeting";
import { OverviewAppHealth } from "@/app/components/dashboard/overview/OverviewAppHealth";
import { OverviewActiveIncidents } from "@/app/components/dashboard/overview/OverviewActiveIncidents";
import { OverviewMetricsSection } from "@/app/components/dashboard/overview/OverviewMetricsSection";
import { OverviewExtraCharts } from "@/app/components/dashboard/overview/OverviewExtraCharts";
import { mergeListQuery } from "@/lib/list-filters-url";
import { parseOverviewListPageSize, parsePageParam } from "@/lib/pagination";
import type { OverviewApiResponse, OverviewHealth, OverviewWorkspaceTelemetry } from "@/lib/overview-api";
import { buildOverviewWorkspaceStats } from "@/lib/overview-workspace-stats";
import { parseOverviewCompare, resolveScopedQueryValue, compareLabelFor, buildErrorGroupDetailHref, formatOverviewDeltaLine } from "@/lib/overview-scope-url";
import { firstQueryValue } from "@/lib/search-params";
import { coalesceOverviewRequest } from "@/lib/api-inflight";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { dashboardDebug } from "@/lib/dashboard-debug";
import { fetchDashboardBootstrap } from "@/lib/dashboard-bootstrap-server";
import { getDashboardUser } from "@/lib/dashboard-user";
import {
  fetchDashboardEnvironments,
  fetchDashboardNavScope,
  getDashboardWorkspaceForRequest,
} from "@/lib/dashboard-workspace-request";
import {
  overviewScopeMatches,
  readOverviewCookieScope,
  type OverviewRequestScope,
} from "@/lib/overview-request-scope";

export const dynamic = "force-dynamic";

const OVERVIEW_PATH = "/dashboard/overview";

async function getOverview(
  range: string,
  app: string | undefined,
  environment: string | undefined,
  compare: string,
  list: {
    errorsPage: number;
    eventsPage: number;
    listPageSize: number;
    errorsSort: string;
    errorsOrder: string;
    topEventsSort: string;
    topEventsOrder: string;
  },
  scope: OverviewRequestScope
) {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (app) params.set("app", app);
  if (environment) params.set("environment", environment);
  if (compare === "week-ago") params.set("compare", "week-ago");
  params.set("errorsPage", String(list.errorsPage));
  params.set("eventsPage", String(list.eventsPage));
  params.set("listPageSize", String(list.listPageSize));
  params.set("errorsSort", list.errorsSort);
  params.set("errorsOrder", list.errorsOrder);
  params.set("topEventsSort", list.topEventsSort);
  params.set("topEventsOrder", list.topEventsOrder);
  const path = `/api/overview?${params.toString()}`;
  const cacheKey = `${scope.projectId}:${scope.organizationId ?? ""}:${path}`;

  return coalesceOverviewRequest(cacheKey, async () => {
    const started = Date.now();
    dashboardDebug("overview", "fetch start", { cacheKey });
    const res = await dashboardApiFetch(path, undefined, {
      projectIdOverride: scope.projectId,
      ...(scope.organizationId
        ? { organizationIdOverride: scope.organizationId }
        : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      dashboardDebug("overview", "fetch failed", {
        status: res.status,
        ms: Date.now() - started,
        body: text.slice(0, 300),
      });
      throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
    }
    dashboardDebug("overview", "fetch ok", { ms: Date.now() - started });
    return res.json() as Promise<OverviewApiResponse>;
  });
}

function emptySeries(): OverviewApiResponse["series"] {
  return {
    bucket: "hour",
    errors: [],
    events: [],
  };
}

function buildOverviewParamsRecord(
  sp: Record<string, string | string[] | undefined>
): Record<string, string> {
  const keys = [
    "range",
    "app",
    "environment",
    "compare",
    "errorsPage",
    "eventsPage",
    "listPageSize",
    "errorsSort",
    "errorsOrder",
    "topEventsSort",
    "topEventsOrder",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

function eventListHref(eventName: string, app: string | null, environment: string | null): string {
  const params = new URLSearchParams();
  params.set("name", eventName);
  if (app) params.set("app", app);
  if (environment) params.set("environment", environment);
  return `/dashboard/events?${params.toString()}`;
}

function formatDeltaLine(
  delta: number,
  kind: "errors" | "events",
  compareLabel: string
): { className: string; text: string } {
  return formatOverviewDeltaLine(delta, kind, compareLabel);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string | string[];
    app?: string | string[];
    environment?: string | string[];
    compare?: string | string[];
    errorsPage?: string | string[];
    eventsPage?: string | string[];
    listPageSize?: string | string[];
    errorsSort?: string | string[];
    errorsOrder?: string | string[];
    topEventsSort?: string | string[];
    topEventsOrder?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rangeRaw = firstQueryValue(params.range);
  const range = rangeRaw === "7d" ? "7d" : "24h";
  const rawApp = firstQueryValue(params.app)?.trim() || null;
  const rawEnvironment = firstQueryValue(params.environment)?.trim() || null;
  const compare = parseOverviewCompare(firstQueryValue(params.compare));
  const errorsPage = parsePageParam(firstQueryValue(params.errorsPage));
  const eventsPage = parsePageParam(firstQueryValue(params.eventsPage));
  const listPageSize = parseOverviewListPageSize(params.listPageSize);
  const errorsSort = firstQueryValue(params.errorsSort) ?? "occurrences";
  const errorsOrder = firstQueryValue(params.errorsOrder) ?? "desc";
  const topEventsSort = firstQueryValue(params.topEventsSort) ?? "count";
  const topEventsOrder = firstQueryValue(params.topEventsOrder) ?? "desc";
  const rangeLabelLong = range === "7d" ? "Last 7 days" : "Last 24 hours";
  const currentOverviewParams = buildOverviewParamsRecord(params);
  const listParams = {
    errorsPage,
    eventsPage,
    listPageSize,
    errorsSort,
    errorsOrder,
    topEventsSort,
    topEventsOrder,
  };

  const cookieScope = await readOverviewCookieScope();
  const pageStarted = Date.now();

  const overviewEarlyPromise =
    cookieScope.projectId !== ""
      ? getOverview(
          range,
          rawApp ?? undefined,
          rawEnvironment ?? undefined,
          compare,
          listParams,
          cookieScope
        ).catch((e) => ({ error: e } as const))
      : Promise.resolve({ error: new Error("No project selected") } as const);

  const [user, workspace, bootstrap, overviewEarly] = await Promise.all([
    getDashboardUser(),
    getDashboardWorkspaceForRequest(),
    fetchDashboardBootstrap(),
    overviewEarlyPromise,
  ]);
  const { organizations, projects, resolvedOrgId, effectiveProjectId } = workspace;

  dashboardDebug("overview", "parallel shell done", {
    ms: Date.now() - pageStarted,
    orgCount: organizations.length,
    projectCount: projects.length,
    resolvedOrgId,
    effectiveProjectId,
    hasUser: user !== null,
    cookieScope,
  });

  const resolvedScope: OverviewRequestScope = {
    projectId: effectiveProjectId,
    organizationId: resolvedOrgId,
  };

  let overviewResult = overviewEarly;
  if (
    effectiveProjectId !== "" &&
    !overviewScopeMatches(cookieScope, resolvedScope)
  ) {
    dashboardDebug("overview", "refetch — scope differs from cookies", {
      cookieScope,
      resolvedScope,
    });
    overviewResult = await getOverview(
      range,
      rawApp ?? undefined,
      rawEnvironment ?? undefined,
      compare,
      listParams,
      resolvedScope
    ).catch((e) => ({ error: e } as const));
  }

  const apps =
    effectiveProjectId === ""
      ? []
      : overviewScopeMatches(cookieScope, resolvedScope)
        ? (bootstrap?.navScope.apps ?? [])
        : (await fetchDashboardNavScope(effectiveProjectId, resolvedOrgId)).apps;

  const app = resolveScopedQueryValue(rawApp, apps);
  if (rawApp !== app) {
    redirect(mergeListQuery(OVERVIEW_PATH, currentOverviewParams, { app }));
  }

  const scopedEnvironments =
    effectiveProjectId === ""
      ? []
      : overviewScopeMatches(cookieScope, resolvedScope) && !app
        ? (bootstrap?.navScope.environments ?? [])
        : await fetchDashboardEnvironments(effectiveProjectId, resolvedOrgId, app);

  const environment = resolveScopedQueryValue(rawEnvironment, scopedEnvironments);
  if (rawEnvironment !== environment) {
    redirect(
      mergeListQuery(OVERVIEW_PATH, currentOverviewParams, { environment })
    );
  }

  const workspaceStats = buildOverviewWorkspaceStats(
    organizations,
    projects,
    resolvedOrgId
  );

  if ("error" in overviewResult) {
    const e = overviewResult.error;
    return (
      <>
        <OverviewGreeting user={user} />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const overviewData: OverviewApiResponse = {
    ...overviewResult,
    series: overviewResult.series ?? emptySeries(),
  };

  const errorsDelta = overviewData.errorsLast24h - overviewData.errorsPrevious;
  const eventsDelta = overviewData.eventsLast24h - overviewData.eventsPrevious;
  const compareLabel = compareLabelFor(compare, range);
  const errDeltaFmt = formatDeltaLine(errorsDelta, "errors", compareLabel);
  const evDeltaFmt = formatDeltaLine(eventsDelta, "events", compareLabel);

  const health: OverviewHealth =
    overviewData.health ?? {
      status: "operational",
      statusLabel: "Operational",
      subtitle: "No health metrics returned",
      errorRatePct: 0,
      errorRateDeltaPct: 0,
      successRatePct: 100,
      throughputPerSec: 0,
      peakThroughputPerSec: 0,
    };
  const activeIssues = overviewData.activeIssues ?? [];
  const sessionDurationSeries = overviewData.sessionDurationSeries ?? [];
  const workspaceTelemetry: OverviewWorkspaceTelemetry = overviewData.workspaceTelemetry ?? {
    ingestRequests: overviewData.eventsLast24h + overviewData.errorsLast24h,
    sdkEventRows: overviewData.eventsLast24h,
    distinctApps: apps.length,
    distinctSdkVersions: 0,
  };

  const contextParts = [rangeLabelLong];
  if (app) contextParts.push(`App: ${app}`);
  if (environment) contextParts.push(`Env: ${environment}`);

  return (
    <>
      <OverviewGreeting
        user={user}
        actions={
          <RangeTabs
            tabs={[
              {
                href: mergeListQuery(OVERVIEW_PATH, currentOverviewParams, {
                  range: null,
                  errorsPage: null,
                  eventsPage: null,
                }),
                label: "24h",
                current: range === "24h",
              },
              {
                href: mergeListQuery(OVERVIEW_PATH, currentOverviewParams, {
                  range: "7d",
                  errorsPage: null,
                  eventsPage: null,
                }),
                label: "7d",
                current: range === "7d",
              },
            ]}
          />
        }
      />

      <OverviewAppHealth health={health} />
      <OverviewActiveIncidents issues={activeIssues} />

      <Suspense fallback={null}>
        <OverviewMetricsSection
          range={range}
          overviewPath={OVERVIEW_PATH}
          currentParams={currentOverviewParams}
          eventsCount={overviewData.eventsLast24h}
          eventsPrevious={overviewData.eventsPrevious}
          errorsCount={overviewData.errorsLast24h}
          errorsPrevious={overviewData.errorsPrevious}
          sessionsCount={overviewData.sessionsCount ?? 0}
          sessionsPrevious={overviewData.sessionsPrevious ?? 0}
          activeUsers={overviewData.activeUsers ?? 0}
          activeUsersPrevious={overviewData.activeUsersPrevious ?? 0}
          workspaceStats={workspaceStats}
          workspaceTelemetry={workspaceTelemetry}
        />
      </Suspense>

      <OverviewExtraCharts
        series={overviewData.series}
        sessionDurationSeries={sessionDurationSeries}
        rangeLabel={rangeLabelLong}
      />

      <DashboardSection
        kicker="Live telemetry"
        title="Trends & breakdown"
        description={`Project-scoped overviewData from your telemetry API · ${contextParts.join(" · ")}`}
        className="mb-8"
      >
        <OverviewSortControls
          path={OVERVIEW_PATH}
          currentParams={currentOverviewParams}
          errorsSort={errorsSort}
          errorsOrder={errorsOrder}
          topEventsSort={topEventsSort}
          topEventsOrder={topEventsOrder}
        />

        <OverviewTrendsChart series={overviewData.series} rangeLabel={rangeLabelLong} />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <OverviewTopBars
            title="Top errors (this page)"
            subtitle="Occurrences in the current table page — compare at a glance"
            rows={mapErrorGroupsToBarRows(overviewData.topErrorGroups ?? [])}
            accent="errors"
            emptyMessage="No error groups recorded on this page."
          />
          <OverviewTopBars
            title="Top events (this page)"
            subtitle="Event name counts on the current table page"
            rows={mapTopEventsToBarRows(overviewData.topEvents ?? [])}
            accent="events"
            emptyMessage="No events recorded on this page."
          />
        </div>
      </DashboardSection>

      <DashboardSection
        kicker="Errors"
        title="Exception & crash signals"
        description="Error occurrences grouped by fingerprint. Higher counts usually mean more user impact."
        className="mb-10"
      >
        <StatCard
          label={`Total error occurrences · ${rangeLabelLong}`}
          value={overviewData.errorsLast24h}
          delta={errDeltaFmt.text}
          deltaTone={
            errorsDelta > 0 ? "danger" : errorsDelta < 0 ? "success" : "muted"
          }
        />

        <h3 className="text-sm font-medium">Top error groups</h3>
        {overviewData.topErrorGroups?.length ? (
          <IssueList>
            {overviewData.topErrorGroups.map(
              (g: {
                id: string;
                message: string;
                app: string;
                occurrences: number;
                last_seen: string;
              }) => (
                <OverviewListItem
                  key={g.id}
                  href={buildErrorGroupDetailHref(g.id, { app, environment })}
                  title={g.message}
                  titleClassName="font-medium text-destructive"
                  badges={<Badge>{g.app}</Badge>}
                  meta={
                    <>
                      {g.occurrences} occurrences · last{" "}
                      <TimeAgo iso={g.last_seen} className="text-muted-foreground" />
                    </>
                  }
                />
              )
            )}
          </IssueList>
        ) : (
          <EmptyState
            title="No errors recorded"
            message={`Nothing matched for ${rangeLabelLong}. Try another range or app filter.`}
          />
        )}
        <Pagination
          total={overviewData.errorsListTotal ?? 0}
          page={overviewData.errorsPage ?? errorsPage}
          pageSize={overviewData.listPageSize ?? listPageSize}
          hrefForPage={(p) =>
            mergeListQuery(OVERVIEW_PATH, currentOverviewParams, {
              errorsPage: String(p),
            })
          }
        />
      </DashboardSection>

      <DashboardSection
        kicker="Events"
        title="Product & analytics events"
        description="Named events your SDK recorded. Separate from errors above."
      >
        <StatCard
          label={`Total event rows · ${rangeLabelLong}`}
          value={overviewData.eventsLast24h}
          delta={evDeltaFmt.text}
          deltaTone={
            eventsDelta > 0 ? "success" : eventsDelta < 0 ? "danger" : "muted"
          }
        />

        <h3 className="text-sm font-medium">Top event names</h3>
        {overviewData.topEvents?.length ? (
          <IssueList>
            {overviewData.topEvents.map(
              (e: {
                name: string;
                count: number;
                app: string;
                platform: string | null;
                environment: string | null;
                release: string | null;
                lastSeen: string | null;
              }) => (
                <OverviewListItem
                  key={e.name}
                  href={eventListHref(e.name, app, environment)}
                  title={e.name}
                  badges={e.app ? <Badge>{e.app}</Badge> : null}
                  meta={
                    <>
                      <span className="tabular-nums">{e.count} in period</span>
                      {" · "}
                      {e.platform ?? "—"} · {e.environment ?? "—"}
                      {e.release ? ` · ${e.release}` : ""}
                      {e.lastSeen ? (
                        <>
                          {" · "}Last seen{" "}
                          <TimeAgo iso={e.lastSeen} className="text-muted-foreground" />
                        </>
                      ) : null}
                    </>
                  }
                />
              )
            )}
          </IssueList>
        ) : (
          <EmptyState
            title="No events recorded"
            message={`Nothing matched for ${rangeLabelLong}. Try another range or app filter.`}
          />
        )}
        <Pagination
          total={overviewData.eventsListTotal ?? 0}
          page={overviewData.eventsPage ?? eventsPage}
          pageSize={overviewData.listPageSize ?? listPageSize}
          hrefForPage={(p) =>
            mergeListQuery(OVERVIEW_PATH, currentOverviewParams, {
              eventsPage: String(p),
            })
          }
        />
      </DashboardSection>
    </>
  );
}
