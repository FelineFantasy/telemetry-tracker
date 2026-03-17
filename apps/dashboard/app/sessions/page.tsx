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
      <div className="range-tabs" role="tablist" aria-label="Time range">
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
      <div className="filter-row" style={{ marginBottom: 16 }}>
        <span className="card__label" style={{ marginRight: 8 }}>
          Filter by app:
        </span>
        <Link
          href={`/sessions${range === "7d" ? "?range=7d" : ""}`}
          className="badge"
          style={{
            textDecoration: "none",
            marginRight: 4,
            ...(appFilter === "" ? { fontWeight: 600 } : {}),
          }}
          aria-current={appFilter === "" ? "page" : undefined}
        >
          All
        </Link>
        {apps.map((a) => (
          <Link
            key={a}
            href={`/sessions?app=${encodeURIComponent(a)}${range === "7d" ? "&range=7d" : ""}`}
            className="badge"
            style={{
              textDecoration: "none",
              marginRight: 4,
              ...(appFilter === a ? { fontWeight: 600 } : {}),
            }}
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
                <th>User ID</th>
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
                  <td>{s.user_id ?? "—"}</td>
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
