const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "../components/PageTitle";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import Link from "next/link";

type SessionRow = {
  id: string;
  session_id: string;
  app: string;
  platform?: string | null;
  user_id?: string | null;
  anonymous_id?: string | null;
  sdk_version?: string | null;
  started_at: string;
  ended_at?: string | null;
};

async function getApps(): Promise<{ apps: string[] }> {
  const res = await fetch(`${API_BASE}/api/apps`, { cache: "no-store" });
  if (!res.ok) return { apps: [] };
  return res.json();
}

async function getSessions(
  app?: string,
  since?: string
): Promise<{ items: SessionRow[] }> {
  const params = new URLSearchParams();
  if (app) params.set("app", app);
  if (since) params.set("since", since);
  const q = params.toString();
  const res = await fetch(`${API_BASE}/api/sessions${q ? `?${q}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function truncate(s: string, len: number) {
  return s.length <= len ? s : s.slice(0, len) + "\u2026";
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; range?: string }>;
}) {
  const params = await searchParams;
  const appFilter = params.app ?? "";
  const range = params.range === "7d" ? "7d" : "24h";
  const since = range;
  const rangeLabel = range === "7d" ? "Last 7 days" : "Last 24 hours";

  let apps: string[] = [];
  let items: SessionRow[] = [];
  try {
    const [appsData, sessionsData] = await Promise.all([
      getApps(),
      getSessions(appFilter || undefined, since),
    ]);
    apps = appsData.apps ?? [];
    items = sessionsData.items ?? [];
  } catch (e) {
    return (
      <>
        <PageTitle title="Sessions" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const context = appFilter
    ? `${rangeLabel} · Filtered by app: ${appFilter}`
    : rangeLabel;

  return (
    <>
      <PageTitle title="Sessions" context={context} />
      <div className="range-tabs" aria-label="Time range">
        <Link
          href={appFilter ? `/sessions?app=${encodeURIComponent(appFilter)}` : "/sessions"}
          role="tab"
          aria-current={range === "24h" ? "page" : undefined}
        >
          Last 24 hours
        </Link>
        <Link
          href={
            appFilter
              ? `/sessions?range=7d&app=${encodeURIComponent(appFilter)}`
              : "/sessions?range=7d"
          }
          role="tab"
          aria-current={range === "7d" ? "page" : undefined}
        >
          Last 7 days
        </Link>
      </div>
      <div className="filter-row">
        <span className="card__label">
          Filter by app:
        </span>
        <Link
          href={`/sessions${range === "7d" ? "?range=7d" : ""}`}
          className="badge"
          aria-current={appFilter === "" ? "page" : undefined}
        >
          All
        </Link>
        {apps.map((a) => (
          <Link
            key={a}
            href={`/sessions?app=${encodeURIComponent(a)}${range === "7d" ? "&range=7d" : ""}`}
            className="badge"
            aria-current={appFilter === a ? "page" : undefined}
          >
            {a}
          </Link>
        ))}
      </div>

      {items.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>App</th>
                <th>Platform</th>
                <th>Identity</th>
                <th>SDK</th>
                <th>Started</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td title={s.session_id}>{truncate(s.session_id, 24)}</td>
                  <td>
                    <Badge>{s.app}</Badge>
                  </td>
                  <td>{s.platform ?? "—"}</td>
                  <td title={s.user_id ?? s.anonymous_id ?? undefined}>
                    {(s.user_id ?? s.anonymous_id)
                      ? truncate(s.user_id ?? s.anonymous_id ?? "", 14)
                      : "—"}
                  </td>
                  <td>{s.sdk_version ?? "—"}</td>
                  <td>{new Date(s.started_at).toLocaleString()}</td>
                  <td>
                    {s.ended_at
                      ? new Date(s.ended_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          message={
            appFilter
              ? `No sessions in this period for app "${appFilter}".`
              : `No sessions in this period (${rangeLabel}).`
          }
        />
      )}
    </>
  );
}
