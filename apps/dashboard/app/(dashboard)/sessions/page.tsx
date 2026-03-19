const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "../../components/PageTitle";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import Link from "next/link";

type SessionRow = {
  id: string;
  session_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  started_at: string;
  ended_at?: string | null;
};

function truncate(s: string, len: number) {
  return s.length <= len ? s : s.slice(0, len) + "\u2026";
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

  let items: SessionRow[] = [];
  try {
    const data = await getSessions(appFilter || undefined, since);
    items = data.items ?? [];
  } catch (e) {
    return (
      <>
        <PageTitle title="Sessions" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const context = appFilter ? `${rangeLabel} · App: ${appFilter}` : rangeLabel;

  const sessionsBase = "/sessions";
  const href24h = appFilter
    ? `${sessionsBase}?app=${encodeURIComponent(appFilter)}`
    : sessionsBase;
  const href7d = appFilter
    ? `${sessionsBase}?range=7d&app=${encodeURIComponent(appFilter)}`
    : `${sessionsBase}?range=7d`;

  return (
    <>
      <PageTitle title="Sessions" context={context} />
      <nav className="range-tabs" aria-label="Time range">
        <Link
          href={href24h}
          aria-current={range === "24h" ? "page" : undefined}
        >
          Last 24 hours
        </Link>
        <Link
          href={href7d}
          aria-current={range === "7d" ? "page" : undefined}
        >
          Last 7 days
        </Link>
      </nav>

      {items.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Identity</th>
                <th>Started</th>
                <th>Ended</th>
                <th aria-hidden>View</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td title={s.session_id}>
                    <Link
                      href={appFilter ? `/sessions/${s.id}?app=${encodeURIComponent(appFilter)}` : `/sessions/${s.id}`}
                      className="list-link"
                    >
                      {truncate(s.session_id, 24)}
                    </Link>
                  </td>
                  <td title={s.user_id ?? s.anonymous_id ?? undefined}>
                    {(s.user_id ?? s.anonymous_id)
                      ? truncate(s.user_id ?? s.anonymous_id ?? "", 20)
                      : "—"}
                  </td>
                  <td>{new Date(s.started_at).toLocaleString()}</td>
                  <td>
                    {s.ended_at
                      ? new Date(s.ended_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="table-cell-view">
                    <Link
                      href={appFilter ? `/sessions/${s.id}?app=${encodeURIComponent(appFilter)}` : `/sessions/${s.id}`}
                    >
                      View
                    </Link>
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
