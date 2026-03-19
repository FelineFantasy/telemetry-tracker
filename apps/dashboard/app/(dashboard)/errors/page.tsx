const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "../../components/PageTitle";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import Link from "next/link";

type ErrorGroupRow = {
  id: string;
  message: string;
  app: string;
  top_stack?: string;
  occurrences: number;
  first_seen: string;
  last_seen: string;
};

async function getErrors(app?: string): Promise<{ items: ErrorGroupRow[] }> {
  const params = app ? `?app=${encodeURIComponent(app)}` : "";
  const res = await fetch(`${API_BASE}/api/errors${params}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function ErrorsListPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const appFilter = params.app ?? "";

  let items: ErrorGroupRow[] = [];
  try {
    const data = await getErrors(appFilter || undefined);
    items = data.items ?? [];
  } catch (e) {
    return (
      <>
        <PageTitle title="Errors" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const context = appFilter ? `App: ${appFilter}` : "All apps";

  return (
    <>
      <PageTitle title="Errors" context={context} />
      {items.length ? (
        <ul className="unstyled-list cards-list">
          {items.map((g) => (
            <li key={g.id} className="card">
              <Badge>{g.app}</Badge>{" "}
              <Link
                href={
                  appFilter
                    ? `/errors/${g.id}?app=${encodeURIComponent(appFilter)}`
                    : `/errors/${g.id}`
                }
                className="list-link"
              >
                {g.message}
              </Link>
              {g.top_stack && (
                <pre className="occurrence-card__meta">{g.top_stack}</pre>
              )}
              <span className="card__label card__label--block">
                {g.occurrences} occurrences · first{" "}
                {new Date(g.first_seen).toLocaleString()} · last{" "}
                {new Date(g.last_seen).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          message={
            appFilter
              ? `No errors for "${appFilter}" yet.`
              : "No error groups yet."
          }
        />
      )}
    </>
  );
}
