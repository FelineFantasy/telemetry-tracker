const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { Badge } from "@/app/components/Badge";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolveApiListTotal,
} from "@/lib/pagination";
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

async function getErrors(
  app: string | undefined,
  page: number,
  pageSize: number
): Promise<{
  items: ErrorGroupRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const params = new URLSearchParams();
  if (app) params.set("app", app);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const res = await fetch(`${API_BASE}/api/errors?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function errorsListHref(opts: {
  app: string;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (opts.app) params.set("app", opts.app);
  if (opts.page > 1) params.set("page", String(opts.page));
  if (opts.pageSize !== DEFAULT_LIST_PAGE_SIZE) {
    params.set("pageSize", String(opts.pageSize));
  }
  const q = params.toString();
  return q ? `/dashboard/errors?${q}` : "/dashboard/errors";
}

export default async function ErrorsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    app?: string;
    page?: string;
    pageSize?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;
  const appFilter = params.app ?? "";
  const page = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize, params.limit);

  let items: ErrorGroupRow[] = [];
  let total = 0;
  try {
    const data = await getErrors(
      appFilter || undefined,
      page,
      pageSize
    );
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
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
                    ? `/dashboard/errors/${g.id}?app=${encodeURIComponent(appFilter)}`
                    : `/dashboard/errors/${g.id}`
                }
                className="list-link !text-danger"
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
      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        hrefForPage={(p) =>
          errorsListHref({ app: appFilter, page: p, pageSize })
        }
      />
    </>
  );
}
