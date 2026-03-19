const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "../components/PageTitle";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { EventsFilter } from "./EventsFilter";

type EventRow = {
  id: string;
  name: string;
  app: string;
  platform?: string | null;
  environment?: string | null;
  release?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  anonymous_id?: string | null;
  sdk_version?: string | null;
  properties?: unknown;
  created_at: string;
};

async function getApps(): Promise<{ apps: string[] }> {
  const res = await fetch(`${API_BASE}/api/apps`, { cache: "no-store" });
  if (!res.ok) return { apps: [] };
  return res.json();
}

async function getEvents(
  app?: string,
  name?: string
): Promise<{ items: EventRow[] }> {
  const params = new URLSearchParams();
  if (app) params.set("app", app);
  if (name) params.set("name", name);
  const q = params.toString();
  const res = await fetch(`${API_BASE}/api/events${q ? `?${q}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; name?: string }>;
}) {
  const params = await searchParams;
  const appFilter = params.app ?? "";
  const nameFilter = params.name ?? "";

  let apps: string[] = [];
  let items: EventRow[] = [];
  try {
    const [appsData, eventsData] = await Promise.all([
      getApps(),
      getEvents(appFilter || undefined, nameFilter || undefined),
    ]);
    apps = appsData.apps ?? [];
    items = eventsData.items ?? [];
  } catch (e) {
    return (
      <>
        <PageTitle title="Events" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const contextParts = [];
  if (appFilter) contextParts.push(`app: ${appFilter}`);
  if (nameFilter) contextParts.push(`name: ${nameFilter}`);
  const context =
    contextParts.length > 0 ? `Filtered by ${contextParts.join(", ")}` : "All events";

  return (
    <>
      <PageTitle title="Events" context={context} />
      <EventsFilter
        apps={apps}
        appFilter={appFilter}
        nameFilter={nameFilter}
      />

      {items.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>App</th>
                <th>Platform</th>
                <th>Environment</th>
                <th>Release</th>
                <th>Identity</th>
                <th>Session ID</th>
                <th>SDK</th>
                <th>Properties</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>
                    <Badge>{e.app}</Badge>
                  </td>
                  <td>{e.platform ?? "—"}</td>
                  <td>{e.environment ?? "—"}</td>
                  <td>{e.release ?? "—"}</td>
                  <td title={e.user_id ?? e.anonymous_id ?? undefined}>
                    {(e.user_id ?? e.anonymous_id)
                      ? ((e.user_id ?? e.anonymous_id)!.length > 14
                          ? (e.user_id ?? e.anonymous_id)!.slice(0, 14) + "\u2026"
                          : e.user_id ?? e.anonymous_id)
                      : "—"}
                  </td>
                  <td>{e.session_id ?? "—"}</td>
                  <td>{e.sdk_version ?? "—"}</td>
                  <td>
                    {e.properties != null &&
                    typeof e.properties === "object" &&
                    Object.keys(e.properties).length > 0 ? (
                      <details>
                        <summary>View</summary>
                        <pre className="properties-json">
                          {JSON.stringify(e.properties, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          message={
            appFilter || nameFilter
              ? `No events for this filter.`
              : "No events yet."
          }
        />
      )}
    </>
  );
}
