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
import { DashboardScopeBar } from "@/app/components/dashboard/shell/DashboardScopeBar";
import { mergeListQuery } from "@/lib/list-filters-url";
import { parseOverviewListPageSize, parsePageParam } from "@/lib/pagination";
import type { OverviewApiResponse, OverviewHealth, OverviewWorkspaceTelemetry } from "@/lib/overview-api";
import { buildOverviewWorkspaceStats } from "@/lib/overview-workspace-stats";
import { parseOverviewCompare, resolveScopedQueryValue } from "@/lib/overview-scope-url";
import { firstQueryValue } from "@/lib/search-params";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardUser } from "@/lib/dashboard-user";
import {
  fetchDashboardAppsList,
  fetchDashboardEnvironments,
  getDashboardWorkspaceForRequest,
} from "@/lib/dashboard-workspace-request";
import { formatOrganizationRailName } from "@/lib/workspace-placeholders";

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
  }
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
  const res = await dashboardApiFetch(`/api/overview?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<OverviewApiResponse>;
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
  kind: "errors" | "events"
): { className: string; text: string } {
  if (delta === 0) {
    return { className: "vs-previous", text: "Same as previous period" };
  }
  const sign = delta > 0 ? "+" : "";
  const text = `${sign}${delta} vs previous period`;
  if (kind === "errors") {
    return {
      className:
        delta > 0 ? "vs-previous positive" : delta < 0 ? "vs-previous negative" : "vs-previous",
      text,
    };
  }
  return {
    className:
      delta > 0 ? "vs-previous negative" : delta < 0 ? "vs-previous positive" : "vs-previous",
    text,
  };
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
  const rangeLabel = range === "7d" ? "7d" : "24h";
  const rangeLabelLong = range === "7d" ? "Last 7 days" : "Last 24 hours";
  const currentOverviewParams = buildOverviewParamsRecord(params);

  const [user, workspace] = await Promise.all([
    getDashboardUser(),
    getDashboardWorkspaceForRequest(),
  ]);
  const { organizations, projects, resolvedOrgId, effectiveProjectId } = workspace;
  const organizationName =
    organizations.find((o) => o.id === resolvedOrgId)?.name ?? null;
  const projectName = projects.find((p) => p.id === effectiveProjectId)?.name ?? null;
  const displayOrgName = organizationName
    ? formatOrganizationRailName(organizationName)
    : null;

  const apps =
    effectiveProjectId === ""
      ? []
      : await fetchDashboardAppsList(effectiveProjectId, resolvedOrgId);

  const app = resolveScopedQueryValue(rawApp, apps);
  const scopedEnvironments =
    effectiveProjectId === ""
      ? []
      : await fetchDashboardEnvironments(effectiveProjectId, resolvedOrgId, app);
  const environment = resolveScopedQueryValue(rawEnvironment, scopedEnvironments);

  const scopeCorrections: Record<string, string | null> = {};
  if (rawApp !== app) scopeCorrections.app = app;
  if (rawEnvironment !== environment) scopeCorrections.environment = environment;
  if (Object.keys(scopeCorrections).length > 0) {
    redirect(mergeListQuery(OVERVIEW_PATH, currentOverviewParams, scopeCorrections));
  }

  const workspaceStats = buildOverviewWorkspaceStats(
    organizations,
    projects,
    resolvedOrgId
  );

  let data: OverviewApiResponse;
  try {
    data = await getOverview(range, app ?? undefined, environment ?? undefined, compare, {
      errorsPage,
      eventsPage,
      listPageSize,
      errorsSort,
      errorsOrder,
      topEventsSort,
      topEventsOrder,
    });
    if (!data.series) {
      data = { ...data, series: emptySeries() };
    }
  } catch (e) {
    return (
      <>
        <OverviewGreeting user={user} />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const errorsDelta = data.errorsLast24h - data.errorsPrevious;
  const eventsDelta = data.eventsLast24h - data.eventsPrevious;
  const errDeltaFmt = formatDeltaLine(errorsDelta, "errors");
  const evDeltaFmt = formatDeltaLine(eventsDelta, "events");

  const health: OverviewHealth =
    data.health ?? {
      status: "operational",
      statusLabel: "Operational",
      subtitle: "No health metrics returned",
      errorRatePct: 0,
      errorRateDeltaPct: 0,
      successRatePct: 100,
      throughputPerSec: 0,
      peakThroughputPerSec: 0,
    };
  const activeIssues = data.activeIssues ?? [];
  const environments = scopedEnvironments;
  const sessionDurationSeries = data.sessionDurationSeries ?? [];
  const workspaceTelemetry: OverviewWorkspaceTelemetry = data.workspaceTelemetry ?? {
    ingestRequests: data.eventsLast24h + data.errorsLast24h,
    sdkEventRows: data.eventsLast24h,
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

      <Suspense fallback={null}>
        <DashboardScopeBar
          organizationName={displayOrgName}
          projectName={projectName}
          apps={apps}
          environments={environments}
          rangeLabel={rangeLabel}
        />
      </Suspense>

      <OverviewAppHealth health={health} />
      <OverviewActiveIncidents issues={activeIssues} />

      <Suspense fallback={null}>
        <OverviewMetricsSection
          range={range}
          overviewPath={OVERVIEW_PATH}
          currentParams={currentOverviewParams}
          eventsCount={data.eventsLast24h}
          eventsPrevious={data.eventsPrevious}
          errorsCount={data.errorsLast24h}
          errorsPrevious={data.errorsPrevious}
          sessionsCount={data.sessionsCount ?? 0}
          sessionsPrevious={data.sessionsPrevious ?? 0}
          activeUsers={data.activeUsers ?? 0}
          activeUsersPrevious={data.activeUsersPrevious ?? 0}
          workspaceStats={workspaceStats}
          workspaceTelemetry={workspaceTelemetry}
        />
      </Suspense>

      <OverviewExtraCharts
        series={data.series}
        sessionDurationSeries={sessionDurationSeries}
        rangeLabel={rangeLabelLong}
      />

      <DashboardSection
        kicker="Live telemetry"
        title="Trends & breakdown"
        description={`Project-scoped data from your telemetry API · ${contextParts.join(" · ")}`}
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

        <OverviewTrendsChart series={data.series} rangeLabel={rangeLabelLong} />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <OverviewTopBars
            title="Top errors (this page)"
            subtitle="Occurrences in the current table page — compare at a glance"
            rows={mapErrorGroupsToBarRows(data.topErrorGroups ?? [])}
            accent="errors"
            emptyMessage="No error groups recorded on this page."
          />
          <OverviewTopBars
            title="Top events (this page)"
            subtitle="Event name counts on the current table page"
            rows={mapTopEventsToBarRows(data.topEvents ?? [])}
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
          value={data.errorsLast24h}
          delta={errDeltaFmt.text}
          deltaTone={
            errorsDelta > 0 ? "danger" : errorsDelta < 0 ? "success" : "muted"
          }
        />

        <h3 className="text-sm font-medium">Top error groups</h3>
        {data.topErrorGroups?.length ? (
          <IssueList>
            {data.topErrorGroups.map(
              (g: {
                id: string;
                message: string;
                app: string;
                occurrences: number;
                last_seen: string;
              }) => (
                <OverviewListItem
                  key={g.id}
                  href={
                    app
                      ? `/dashboard/errors/${g.id}?app=${encodeURIComponent(app)}`
                      : `/dashboard/errors/${g.id}`
                  }
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
          total={data.errorsListTotal ?? 0}
          page={data.errorsPage ?? errorsPage}
          pageSize={data.listPageSize ?? listPageSize}
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
          value={data.eventsLast24h}
          delta={evDeltaFmt.text}
          deltaTone={
            eventsDelta > 0 ? "success" : eventsDelta < 0 ? "danger" : "muted"
          }
        />

        <h3 className="text-sm font-medium">Top event names</h3>
        {data.topEvents?.length ? (
          <IssueList>
            {data.topEvents.map(
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
          total={data.eventsListTotal ?? 0}
          page={data.eventsPage ?? eventsPage}
          pageSize={data.listPageSize ?? listPageSize}
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
