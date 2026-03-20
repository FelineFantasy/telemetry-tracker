const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { RangeTabs } from "@/app/components/dashboard/RangeTabs";
import { Table, TableListLink, TableWrap } from "@/app/components/ui/Table";
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

  const sessionsBase = "/dashboard/sessions";
  const href24h = appFilter
    ? `${sessionsBase}?app=${encodeURIComponent(appFilter)}`
    : sessionsBase;
  const href7d = appFilter
    ? `${sessionsBase}?range=7d&app=${encodeURIComponent(appFilter)}`
    : `${sessionsBase}?range=7d`;

  return (
    <>
      <PageTitle title="Sessions" context={context} />
      <RangeTabs
        tabs={[
          { href: href24h, label: "Last 24 hours", current: range === "24h" },
          { href: href7d, label: "Last 7 days", current: range === "7d" },
        ]}
      />

      {items.length ? (
        <TableWrap>
          <Table>
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
                    <TableListLink
                      href={appFilter ? `/dashboard/sessions/${s.id}?app=${encodeURIComponent(appFilter)}` : `/dashboard/sessions/${s.id}`}
                    >
                      {truncate(s.session_id, 24)}
                    </TableListLink>
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
                      href={appFilter ? `/dashboard/sessions/${s.id}?app=${encodeURIComponent(appFilter)}` : `/dashboard/sessions/${s.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
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
