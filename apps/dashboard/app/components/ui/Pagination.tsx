import Link from "next/link";

const NEIGHBOR_PAGES = 2;

function normalizeTotalCount(total: unknown, pageSize: number): number {
  const n = typeof total === "number" ? total : Number(total);
  if (!Number.isFinite(n) || n < 0) return 0;
  const ps = Number(pageSize);
  if (!Number.isFinite(ps) || ps <= 0) return 0;
  return Math.floor(n);
}

/** Merges page 1, last page, and `current ± NEIGHBOR_PAGES`, then inserts ellipses for gaps. */
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
    if (i > 0 && n - sorted[i - 1] > 1) {
      out.push("ellipsis");
    }
    out.push(n);
  }
  return out;
}

/**
 * Range summary + First / Prev / numbered pages (±2 around current) / Next / Last.
 * Renders nothing when there are no rows or only a single page.
 */
export function Pagination({
  total,
  page,
  pageSize,
  hrefForPage,
}: {
  total: unknown;
  page: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
}) {
  const totalCount = normalizeTotalCount(total, pageSize);
  if (totalCount <= 0) return null;

  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pageItems = buildPageItems(totalPages, page);

  return (
    <nav className="pagination" aria-label="Pagination">
      <div className="pagination__info">
        <span className="pagination__range">
          {from}–{to} of {totalCount}
        </span>
        <span className="pagination__pages" aria-hidden>
          {" "}
          · Page {page} of {totalPages}
        </span>
      </div>
      <div className="pagination__bar" role="group" aria-label="Page navigation">
        <ol className="pagination__nums">
          {pageItems.map((item, i) =>
            item === "ellipsis" ? (
              <li key={`e-${i}`} className="pagination__nums-item" aria-hidden>
                <span className="pagination__ellipsis">…</span>
              </li>
            ) : (
              <li key={item} className="pagination__nums-item">
                {item === page ? (
                  <span
                    className="pagination__num pagination__num--current"
                    aria-current="page"
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </span>
                ) : (
                  <Link href={hrefForPage(item)} className="pagination__num" aria-label={`Page ${item}`}>
                    {item}
                  </Link>
                )}
              </li>
            )
          )}
        </ol>
      </div>
    </nav>
  );
}
