import Link from "next/link";

/**
 * Previous / next + page indicator. Hides when `total` fits in one page.
 */
export function Pagination({
  total,
  page,
  pageSize,
  hrefForPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0 || totalPages <= 1) return null;

  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <div className="pagination__info">
        <span className="pagination__range">
          {from}–{to} of {total}
        </span>
        <span className="pagination__pages" aria-hidden>
          {" "}
          · Page {page} of {totalPages}
        </span>
      </div>
      <div className="pagination__controls">
        {prev != null ? (
          <Link href={hrefForPage(prev)} className="pagination__btn" rel="prev">
            Previous
          </Link>
        ) : (
          <span className="pagination__btn pagination__btn--disabled">Previous</span>
        )}
        {next != null ? (
          <Link href={hrefForPage(next)} className="pagination__btn" rel="next">
            Next
          </Link>
        ) : (
          <span className="pagination__btn pagination__btn--disabled">Next</span>
        )}
      </div>
    </nav>
  );
}
