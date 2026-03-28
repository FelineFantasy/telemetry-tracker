const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { Table, TableListLink, TableWrap } from "@/app/components/ui/Table";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolveApiListTotal,
} from "@/lib/pagination";
import { EventsFilter } from "./EventsFilter";
import Link from "next/link";

type EventRow = {
  id: string;
  name: string;
  properties?: unknown;
  created_at: string;
};

async function getEvents(
  app: string | undefined,
  name: string | undefined,
  page: number,
  pageSize: number
): Promise<{
  items: EventRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const params = new URLSearchParams();
  if (app) params.set("app", app);
  if (name) params.set("name", name);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const res = await fetch(`${API_BASE}/api/events?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function eventsListHref(opts: {
  app: string;
  name: string;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (opts.app) params.set("app", opts.app);
  if (opts.name) params.set("name", opts.name);
  if (opts.page > 1) params.set("page", String(opts.page));
  if (opts.pageSize !== DEFAULT_LIST_PAGE_SIZE) {
    params.set("pageSize", String(opts.pageSize));
  }
  const q = params.toString();
  return q ? `/dashboard/events?${q}` : "/dashboard/events";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    app?: string;
    name?: string;
    page?: string;
    pageSize?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;
  const appFilter = params.app ?? "";
  const nameFilter = params.name ?? "";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize, params.limit);

  let items: EventRow[] = [];
  let total = 0;
  try {
    const data = await getEvents(
      appFilter || undefined,
      nameFilter || undefined,
      page,
      pageSize
    );
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
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
      <EventsFilter
        appFilter={appFilter}
        nameFilter={nameFilter}
        pageSize={pageSize}
      />

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
      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        hrefForPage={(p) =>
          eventsListHref({
            app: appFilter,
            name: nameFilter,
            page: p,
            pageSize,
          })
        }
      />
    </>
  );
}
