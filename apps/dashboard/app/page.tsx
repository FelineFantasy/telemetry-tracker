const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "./components/PageTitle";
import { Card } from "./components/Card";
import { Badge } from "./components/Badge";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import Link from "next/link";

async function getOverview(range: string, compare: boolean) {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (compare) params.set("compare", "true");
  const url = `${API_BASE}/api/overview?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function RangeTabs({ current, compare }: { current: string; compare: boolean }) {
  return (
    <div className="range-tabs" role="tablist" aria-label="Time range">
      <Link
        href={compare ? "/?compare=true" : "/"}
        role="tab"
        aria-selected={current === "24h"}
        aria-current={current === "24h" ? "page" : undefined}
      >
        Last 24 hours
      </Link>
      <Link
        href={compare ? "/?range=7d&compare=true" : "/?range=7d"}
        role="tab"
        aria-selected={current === "7d"}
        aria-current={current === "7d" ? "page" : undefined}
      >
        Last 7 days
      </Link>
    </div>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; compare?: string }>;
}) {
  const params = await searchParams;
  const range = params.range === "7d" ? "7d" : "24h";
  const compare = params.compare === "true" || params.compare === "1";
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
    data = await getOverview(range, compare);
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

  return (
    <>
      <PageTitle title="Overview" context={rangeLabel} />
      <RangeTabs current={range} compare={compare} />
      <p className="page-context" style={{ marginTop: -8, marginBottom: 16 }}>
        {compare ? (
          <Link href={range === "7d" ? "/?range=7d" : "/"}>
            Hide comparison with previous period
          </Link>
        ) : (
          <Link
            href={
              range === "7d"
                ? "/?range=7d&compare=true"
                : "/?compare=true"
            }
          >
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
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.topErrorGroups.map(
              (g: {
                id: string;
                message: string;
                app: string;
                occurrences: number;
                last_seen: string;
              }) => (
                <li key={g.id} style={{ marginBottom: 8 }}>
                  <Badge>{g.app}</Badge>{" "}
                  <Link href={`/errors/${g.id}`} className="list-link">
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
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.topEvents.map((e: { name: string; count: number }) => (
              <li key={e.name} style={{ marginBottom: 8 }}>
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
