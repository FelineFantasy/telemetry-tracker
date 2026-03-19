const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "../../components/PageTitle";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { firstQueryValue } from "../../../lib/search-params";
import Link from "next/link";

/** Overview lives at `/overview` so `searchParams` (e.g. `app`) are reliably applied; `/` redirects here. */
export const dynamic = "force-dynamic";

const OVERVIEW_PATH = "/overview";

async function getOverview(range: string, compare: boolean, app?: string) {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (compare) params.set("compare", "true");
  if (app) params.set("app", app);
  const url = `${API_BASE}/api/overview?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function rangeHref(path: string, range: string, compare: boolean, app: string | null): string {
  const params = new URLSearchParams();
  if (range === "7d") params.set("range", "7d");
  if (compare) params.set("compare", "true");
  if (app) params.set("app", app);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

function RangeTabs({
  current,
  compare,
  app,
}: {
  current: string;
  compare: boolean;
  app: string | null;
}) {
  return (
    <nav className="range-tabs" aria-label="Time range">
      <Link
        href={rangeHref(OVERVIEW_PATH, "24h", compare, app)}
        aria-current={current === "24h" ? "page" : undefined}
      >
        Last 24 hours
      </Link>
      <Link
        href={rangeHref(OVERVIEW_PATH, "7d", compare, app)}
        aria-current={current === "7d" ? "page" : undefined}
      >
        Last 7 days
      </Link>
    </nav>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string | string[];
    compare?: string | string[];
    app?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rangeRaw = firstQueryValue(params.range);
  const range = rangeRaw === "7d" ? "7d" : "24h";
  const compareRaw = firstQueryValue(params.compare);
  const compare = compareRaw === "true" || compareRaw === "1";
  const app = firstQueryValue(params.app)?.trim() || null;
  const rangeLabel = range === "7d" ? "Last 7 days" : "Last 24 hours";

  let data: {
    range?: string;
    errorsLast24h: number;
    eventsLast24h: number;
    errorsPrevious?: number | null;
    eventsPrevious?: number | null;
    topErrorGroups?: Array<{
      id: string;
      message: string;
      app: string;
      occurrences: number;
      last_seen: string;
    }>;
    topEvents?: Array<{ name: string; count: number }>;
  };
  try {
    data = await getOverview(range, compare, app ?? undefined);
  } catch (e) {
    return (
      <>
        <PageTitle title="Overview" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const errorsPrev = data.errorsPrevious;
  const eventsPrev = data.eventsPrevious;
  const contextParts = [rangeLabel];
  if (app) contextParts.push(`App: ${app}`);
  const context = contextParts.join(" · ");

  return (
    <>
      <PageTitle title="Overview" context={context} />
      <RangeTabs current={range} compare={compare} app={app} />
      <p className="page-context overview-compare">
        {compare ? (
          <Link href={rangeHref(OVERVIEW_PATH, range, false, app)}>
            Hide comparison with previous period
          </Link>
        ) : (
          <Link href={rangeHref(OVERVIEW_PATH, range, true, app)}>
            Compare with previous period
          </Link>
        )}
      </p>

      <div className="stat-grid">
        <Card label={`Errors in ${rangeLabel}`}>
          {data.errorsLast24h}
          {compare && typeof errorsPrev === "number" && (
            <span
              className={
                data.errorsLast24h > errorsPrev
                  ? "vs-previous positive"
                  : data.errorsLast24h < errorsPrev
                    ? "vs-previous negative"
                    : "vs-previous"
              }
            >
              {data.errorsLast24h > errorsPrev && "+"}
              {data.errorsLast24h - errorsPrev} vs previous period
            </span>
          )}
        </Card>
        <Card label={`Events in ${rangeLabel}`}>
          {data.eventsLast24h}
          {compare && typeof eventsPrev === "number" && (
            <span
              className={
                data.eventsLast24h > eventsPrev
                  ? "vs-previous positive"
                  : data.eventsLast24h < eventsPrev
                    ? "vs-previous negative"
                    : "vs-previous"
              }
            >
              {data.eventsLast24h > eventsPrev && "+"}
              {data.eventsLast24h - eventsPrev} vs previous period
            </span>
          )}
        </Card>
      </div>

      <section>
        <h2 className="section-title">Top error groups in {rangeLabel}</h2>
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
                    href={app ? `/errors/${g.id}?app=${encodeURIComponent(app)}` : `/errors/${g.id}`}
                    className="list-link"
                  >
                    {g.message}
                  </Link>{" "}
                  — {g.occurrences} occurrences (last:{" "}
                  {new Date(g.last_seen).toLocaleString()})
                </li>
              )
            )}
          </ul>
        ) : (
          <EmptyState message={`No errors in this period (${rangeLabel}).`} />
        )}
      </section>

      <section>
        <h2 className="section-title">Top events in {rangeLabel}</h2>
        {data.topEvents?.length ? (
          <ul className="unstyled-list cards-list">
            {data.topEvents.map((e: { name: string; count: number }) => (
              <li key={e.name}>
                {e.name}: {e.count}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message={`No events in this period (${rangeLabel}).`} />
        )}
      </section>
    </>
  );
}
