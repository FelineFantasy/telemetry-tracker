import Link from "next/link";
import type { ReactNode } from "react";

const NEIGHBOR_PAGES = 2;

const navControlClass =
  "grid h-8 place-items-center rounded-md border border-border px-2 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground";
const navControlDisabledClass =
  "grid h-8 place-items-center rounded-md border border-border px-2 font-mono text-[12px] text-muted-foreground opacity-40";

function normalizeTotalCount(total: unknown, pageSize: number): number {
  const n = typeof total === "number" ? total : Number(total);
  if (!Number.isFinite(n) || n < 0) return 0;
  const ps = Number(pageSize);
  if (!Number.isFinite(ps) || ps <= 0) return 0;
  return Math.floor(n);
}

function buildPageItems(
  totalPages: number,
  page: number
): (number | "ellipsis")[] {
  const set = new Set<number>();
  set.add(1);
  set.add(totalPages);
  for (let p = page - NEIGHBOR_PAGES; p <= page + NEIGHBOR_PAGES; p++) {
    if (p >= 1 && p <= totalPages) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    if (i > 0 && n - sorted[i - 1]! > 1) {
      out.push("ellipsis");
    }
    out.push(n!);
  }
  return out;
}

function PageNavControl({
  targetPage,
  label,
  children,
  hrefForPage,
  onPageChange,
  disabled,
}: {
  targetPage: number;
  label: string;
  children: ReactNode;
  hrefForPage: (page: number) => string;
  onPageChange?: (page: number) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className={navControlDisabledClass} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  if (onPageChange) {
    return (
      <button
        type="button"
        onClick={() => onPageChange(targetPage)}
        className={navControlClass}
        aria-label={label}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={hrefForPage(targetPage)} className={navControlClass} aria-label={label}>
      {children}
    </Link>
  );
}

export function Pagination({
  total,
  page,
  pageSize,
  hrefForPage,
  onPageChange,
}: {
  total: unknown;
  page: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
  /** Client navigation without full page reload. */
  onPageChange?: (page: number) => void;
}) {
  const totalCount = normalizeTotalCount(total, pageSize);
  if (totalCount <= 0) return null;

  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pageItems = buildPageItems(totalPages, page);

  return (
    <nav className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination">
      <div className="font-mono text-[12px] text-muted-foreground">
        <span className="text-foreground tabular-nums">
          {from}–{to}
        </span>{" "}
        of <span className="tabular-nums">{totalCount}</span>
        <span className="hidden sm:inline"> · Page {page} of {totalPages}</span>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
        <PageNavControl
          targetPage={page - 1}
          label="Previous page"
          hrefForPage={hrefForPage}
          onPageChange={onPageChange}
          disabled={page <= 1}
        >
          Previous
        </PageNavControl>
        <ol className="flex items-center gap-1">
          {pageItems.map((item, i) =>
            item === "ellipsis" ? (
              <li key={`e-${i}`} aria-hidden>
                <span className="px-2 text-muted-foreground">…</span>
              </li>
            ) : (
              <li key={item}>
                {item === page ? (
                  <span
                    className="grid h-8 min-w-8 place-items-center rounded-md bg-foreground px-2 font-mono text-[12px] text-background"
                    aria-current="page"
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </span>
                ) : onPageChange ? (
                  <button
                    type="button"
                    onClick={() => onPageChange(item)}
                    className="grid h-8 min-w-8 place-items-center rounded-md border border-border px-2 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </button>
                ) : (
                  <Link
                    href={hrefForPage(item)}
                    className="grid h-8 min-w-8 place-items-center rounded-md border border-border px-2 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </Link>
                )}
              </li>
            )
          )}
        </ol>
        <PageNavControl
          targetPage={page + 1}
          label="Next page"
          hrefForPage={hrefForPage}
          onPageChange={onPageChange}
          disabled={page >= totalPages}
        >
          Next
        </PageNavControl>
      </div>
    </nav>
  );
}
