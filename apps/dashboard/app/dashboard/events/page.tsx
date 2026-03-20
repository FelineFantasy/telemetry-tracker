const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Table, TableListLink, TableWrap } from "@/app/components/ui/Table";
import { EventsFilter } from "./EventsFilter";
import Link from "next/link";

type EventRow = {
  id: string;
  name: string;
  properties?: unknown;
  created_at: string;
};

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

  let items: EventRow[] = [];
  try {
    const data = await getEvents(appFilter || undefined, nameFilter || undefined);
    items = data.items ?? [];
  } catch (e) {
    return (
      <>
        <PageTitle title="Events" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const contextParts = [];
  if (appFilter) contextParts.push(`App: ${appFilter}`);
  if (nameFilter) contextParts.push(`Event: ${nameFilter}`);
  const context =
    contextParts.length > 0 ? contextParts.join(" · ") : "All events";

  return (
    <>
      <PageTitle title="Events" context={context} />
      <EventsFilter appFilter={appFilter} nameFilter={nameFilter} />

      {items.length ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Properties</th>
                <th>Created</th>
                <th aria-hidden>View</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <TableListLink href={appFilter ? `/dashboard/events/${e.id}?app=${encodeURIComponent(appFilter)}` : `/dashboard/events/${e.id}`}>
                      {e.name}
                    </TableListLink>
                  </td>
                  <td className="table-cell-properties">
                    {e.properties != null &&
                    typeof e.properties === "object" &&
                    Object.keys(e.properties as object).length > 0 ? (
                      <pre className="table-properties-json">
                        {JSON.stringify(e.properties, null, 2)}
                      </pre>
                    ) : (
                      <span className="table-properties-empty">—</span>
                    )}
                  </td>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                  <td className="table-cell-view">
                    <Link href={appFilter ? `/dashboard/events/${e.id}?app=${encodeURIComponent(appFilter)}` : `/dashboard/events/${e.id}`}>
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
            appFilter || nameFilter
              ? "No events for this filter."
              : "No events yet."
          }
        />
      )}
    </>
  );
}
