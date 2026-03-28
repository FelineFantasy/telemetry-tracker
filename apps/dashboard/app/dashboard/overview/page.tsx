const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { RangeTabs } from "@/app/components/dashboard/RangeTabs";
import { Pagination } from "@/app/components/ui/Pagination";
import {
  OVERVIEW_LIST_PAGE_SIZE,
  parseOverviewListPageSize,
  parsePageParam,
} from "@/lib/pagination";
import { firstQueryValue } from "@/lib/search-params";
import Link from "next/link";

export const dynamic = "force-dynamic";

const OVERVIEW_PATH = "/dashboard/overview";

async function getOverview(
  range: string,
  app: string | undefined,
  list: {
    errorsPage: number;
    eventsPage: number;
    listPageSize: number;
  }
) {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (app) params.set("app", app);
  params.set("errorsPage", String(list.errorsPage));
  params.set("eventsPage", String(list.eventsPage));
  params.set("listPageSize", String(list.listPageSize));
  const url = `${API_BASE}/api/overview?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function rangeHref(path: string, range: string, app: string | null): string {
  const params = new URLSearchParams();
  if (range === "7d") params.set("range", "7d");
  if (app) params.set("app", app);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

function overviewListHref(opts: {
  range: string;
  app: string | null;
  errorsPage: number;
  eventsPage: number;
  listPageSize: number;
}) {
  const params = new URLSearchParams();
  if (opts.range === "7d") params.set("range", "7d");
  if (opts.app) params.set("app", opts.app);
  if (opts.errorsPage > 1) params.set("errorsPage", String(opts.errorsPage));
  if (opts.eventsPage > 1) params.set("eventsPage", String(opts.eventsPage));
  if (opts.listPageSize !== OVERVIEW_LIST_PAGE_SIZE) {
    params.set("listPageSize", String(opts.listPageSize));
  }
  const q = params.toString();
  return q ? `${OVERVIEW_PATH}?${q}` : OVERVIEW_PATH;
}

function eventListHref(eventName: string, app: string | null): string {
  const params = new URLSearchParams();
  params.set("name", eventName);
  if (app) params.set("app", app);
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
    errorsPage?: string | string[];
    eventsPage?: string | string[];
    listPageSize?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rangeRaw = firstQueryValue(params.range);
  const range = rangeRaw === "7d" ? "7d" : "24h";
  const app = firstQueryValue(params.app)?.trim() || null;
  const errorsPage = parsePageParam(firstQueryValue(params.errorsPage));
  const eventsPage = parsePageParam(firstQueryValue(params.eventsPage));
  const listPageSize = parseOverviewListPageSize(params.listPageSize);
  const rangeLabel = range === "7d" ? "Last 7 days" : "Last 24 hours";

  let data: {
    range?: string;
    errorsLast24h: number;
    eventsLast24h: number;
    errorsPrevious: number;
    eventsPrevious: number;
    topErrorGroups?: Array<{
      id: string;
      message: string;
      app: string;
      occurrences: number;
      last_seen: string;
    }>;
    topEvents?: Array<{
      name: string;
      count: number;
      app: string;
      platform: string | null;
      environment: string | null;
      release: string | null;
      lastSeen: string | null;
    }>;
    errorsListTotal?: number;
    eventsListTotal?: number;
    errorsPage?: number;
    eventsPage?: number;
    listPageSize?: number;
  };
  try {
    data = await getOverview(range, app ?? undefined, {
      errorsPage,
      eventsPage,
      listPageSize,
    });
  } catch (e) {
    return (
      <>
        <PageTitle title="Overview" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const errorsDelta = data.errorsLast24h - data.errorsPrevious;
  const eventsDelta = data.eventsLast24h - data.eventsPrevious;
  const errDeltaFmt = formatDeltaLine(errorsDelta, "errors");
  const evDeltaFmt = formatDeltaLine(eventsDelta, "events");
  const contextParts = [rangeLabel];
  if (app) contextParts.push(`App: ${app}`);
  const context = contextParts.join(" · ");

  return (
    <>
      <PageTitle title="Overview" context={context} />
      <RangeTabs
        tabs={[
          {
            href: rangeHref(OVERVIEW_PATH, "24h", app),
            label: "Last 24 hours",
            current: range === "24h",
          },
          {
            href: rangeHref(OVERVIEW_PATH, "7d", app),
            label: "Last 7 days",
            current: range === "7d",
          },
        ]}
      />

      <p className="page-context overview-compare text-muted-foreground">
        vs previous period (same length window immediately before)
      </p>

      <section className="overview-region overview-region--errors" aria-labelledby="overview-errors-heading">
        <header className="overview-region__header">
          <p className="overview-region__kicker" id="overview-errors-kicker">
            Errors
          </p>
          <h2 className="overview-region__title" id="overview-errors-heading">
            Exception & crash signals
          </h2>
          <p className="overview-region__lede">
            Error occurrences grouped by fingerprint. Higher counts usually mean more user impact.
          </p>
        </header>

        <div className="overview-region__stats">
          <Card label={`Total error occurrences · ${rangeLabel}`}>
            {data.errorsLast24h}
            <span className={errDeltaFmt.className}>{errDeltaFmt.text}</span>
          </Card>
        </div>

        <h3 className="overview-region__subtitle">Top error groups</h3>
        {data.topErrorGroups?.length ? (
          <ul className="unstyled-list cards-list">
            {data.topErrorGroups.map(
              (g: {
                id: string;
                message: string;
                app: string;
                occurrences: number;
                last_seen: string;
              }) => (
                <li key={g.id}>
                  <Badge>{g.app}</Badge>{" "}
                  <Link
                    href={app ? `/dashboard/errors/${g.id}?app=${encodeURIComponent(app)}` : `/dashboard/errors/${g.id}`}
                    className="list-link !text-danger"
                  >
                    {g.message}
                  </Link>{" "}
                  <span className="text-muted-foreground text-sm">
                    — {g.occurrences} occurrences (last: {new Date(g.last_seen).toLocaleString()})
                  </span>
                </li>
              )
            )}
          </ul>
        ) : (
          <EmptyState message={`No errors in this period (${rangeLabel}).`} />
        )}
        <Pagination
          total={data.errorsListTotal ?? 0}
          page={data.errorsPage ?? errorsPage}
          pageSize={data.listPageSize ?? listPageSize}
          hrefForPage={(p) =>
            overviewListHref({
              range,
              app,
              errorsPage: p,
              eventsPage: data.eventsPage ?? eventsPage,
              listPageSize: data.listPageSize ?? listPageSize,
            })
          }
        />
      </section>

      <section className="overview-region overview-region--events" aria-labelledby="overview-events-heading">
        <header className="overview-region__header">
          <p className="overview-region__kicker" id="overview-events-kicker">
            Events
          </p>
          <h2 className="overview-region__title" id="overview-events-heading">
            Product & analytics events
          </h2>
          <p className="overview-region__lede">
            Named events your SDK recorded (screen views, actions, custom metrics). Separate from errors
            above.
          </p>
        </header>

        <div className="overview-region__stats">
          <Card label={`Total event rows · ${rangeLabel}`}>
            {data.eventsLast24h}
            <span className={evDeltaFmt.className}>{evDeltaFmt.text}</span>
          </Card>
        </div>

        <h3 className="overview-region__subtitle">Top event names</h3>
        {data.topEvents?.length ? (
          <ul className="unstyled-list cards-list">
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
                <li key={e.name} className="overview-event-row">
                  <div className="overview-event-row__main">
                    <Link
                      href={eventListHref(e.name, app)}
                      className="list-link font-semibold text-foreground"
                    >
                      {e.name}
                    </Link>
                    <span className="overview-event-row__count">{e.count} in period</span>
                  </div>
                  <div className="overview-event-row__meta">
                    {e.app ? <Badge>{e.app}</Badge> : null}
                    <span className="text-muted-foreground text-sm">
                      {e.platform ?? "—"} · {e.environment ?? "—"}
                      {e.release ? ` · ${e.release}` : ""}
                    </span>
                    {e.lastSeen ? (
                      <span className="text-muted-foreground text-sm">
                        Last: {new Date(e.lastSeen).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            )}
          </ul>
        ) : (
          <EmptyState message={`No events in this period (${rangeLabel}).`} />
        )}
        <Pagination
          total={data.eventsListTotal ?? 0}
          page={data.eventsPage ?? eventsPage}
          pageSize={data.listPageSize ?? listPageSize}
          hrefForPage={(p) =>
            overviewListHref({
              range,
              app,
              errorsPage: data.errorsPage ?? errorsPage,
              eventsPage: p,
              listPageSize: data.listPageSize ?? listPageSize,
            })
          }
        />
      </section>
    </>
  );
}
