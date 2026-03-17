const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "../components/PageTitle";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
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

async function getApps(): Promise<{ apps: string[] }> {
  const res = await fetch(`${API_BASE}/api/apps`, { cache: "no-store" });
  if (!res.ok) return { apps: [] };
  return res.json();
}

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

  let apps: string[] = [];
  let items: ErrorGroupRow[] = [];
  try {
    const [appsData, errorsData] = await Promise.all([
      getApps(),
      getErrors(appFilter || undefined),
    ]);
    apps = appsData.apps ?? [];
    items = errorsData.items ?? [];
  } catch (e) {
    return (
      <>
        <PageTitle title="Errors" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const context = appFilter
    ? `Filtered by app: ${appFilter}`
    : "All error groups";

  return (
    <>
      <PageTitle title="Errors" context={context} />
      <div className="filter-row">
        <span className="card__label" style={{ marginRight: 8 }}>
          Filter by app:
        </span>
        <Link
          href="/errors"
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
            href={`/errors?app=${encodeURIComponent(a)}`}
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
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((g) => (
            <li
              key={g.id}
              className="card"
              style={{ marginBottom: 8 }}
            >
              <Badge>{g.app}</Badge>{" "}
              <Link href={`/errors/${g.id}`} className="list-link">
                {g.message}
              </Link>
              {g.top_stack && (
                <pre
                  className="occurrence-card__meta"
                  style={{ margin: "4px 0 0 0" }}
                >
                  {g.top_stack}
                </pre>
              )}
              <span className="card__label" style={{ display: "block", marginTop: 4 }}>
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
              ? `No error groups for app "${appFilter}".`
              : "No error groups yet."
          }
        />
      )}
    </>
  );
}
