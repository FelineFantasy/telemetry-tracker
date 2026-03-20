const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { RangeTabs } from "@/app/components/dashboard/RangeTabs";
import { firstQueryValue } from "@/lib/search-params";
import Link from "next/link";

export const dynamic = "force-dynamic";

const OVERVIEW_PATH = "/dashboard/overview";

async function getOverview(range: string, app?: string) {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (app) params.set("app", app);
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

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string | string[];
    app?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rangeRaw = firstQueryValue(params.range);
  const range = rangeRaw === "7d" ? "7d" : "24h";
  const app = firstQueryValue(params.app)?.trim() || null;
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
    topEvents?: Array<{ name: string; count: number }>;
  };
  try {
    data = await getOverview(range, app ?? undefined);
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

      <div className="stat-grid">
        <Card label={`Errors in ${rangeLabel}`}>
          {data.errorsLast24h}
          {typeof errorsDelta === "number" && !isNaN(errorsDelta) && (
            <span
              className={
                errorsDelta > 0
                  ? "vs-previous positive"
                  : errorsDelta < 0
                    ? "vs-previous negative"
                    : "vs-previous"
              }
            >
              {errorsDelta > 0 && "+"}
              {errorsDelta} vs previous period
            </span>
          )}
        </Card>
        <Card label={`Events in ${rangeLabel}`}>
          {data.eventsLast24h}
          {typeof eventsDelta === "number" && !isNaN(eventsDelta) && (
            <span
              className={
                eventsDelta > 0
                  ? "vs-previous negative"
                  : eventsDelta < 0
                    ? "vs-previous positive"
                    : "vs-previous"
              }
            >
              {eventsDelta > 0 && "+"}
              {eventsDelta} vs previous period
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
                    href={app ? `/dashboard/errors/${g.id}?app=${encodeURIComponent(app)}` : `/dashboard/errors/${g.id}`}
                    className="list-link !text-danger"
                  >
                    {g.message}
                  </Link>{" "}
                  <span className="text-gray-600 text-sm">
                    — {g.occurrences} occurrences (last:{" "}
                    {new Date(g.last_seen).toLocaleString()})
                  </span>
                </li>
              )
            )}
          </ul>
        ) : (
          <EmptyState message={`No errors in this period (${rangeLabel}).`} />
        )}
      </section>

      <section className="mt-10">
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
