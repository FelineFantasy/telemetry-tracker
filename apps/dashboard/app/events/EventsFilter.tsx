import Link from "next/link";

export function EventsFilter({
  apps,
  appFilter,
  nameFilter,
}: {
  apps: string[];
  appFilter: string;
  nameFilter: string;
}) {
  return (
    <div className="filter-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span className="card__label">Filter by app:</span>
        <Link
          href={nameFilter ? `/events?name=${encodeURIComponent(nameFilter)}` : "/events"}
          className="badge"
          style={{
            textDecoration: "none",
            ...(appFilter === "" ? { fontWeight: 600 } : {}),
          }}
          aria-current={appFilter === "" ? "page" : undefined}
        >
          All
        </Link>
        {apps.map((a) => (
          <Link
            key={a}
            href={
              nameFilter
                ? `/events?app=${encodeURIComponent(a)}&name=${encodeURIComponent(nameFilter)}`
                : `/events?app=${encodeURIComponent(a)}`
            }
            className="badge"
            style={{
              textDecoration: "none",
              ...(appFilter === a ? { fontWeight: 600 } : {}),
            }}
            aria-current={appFilter === a ? "page" : undefined}
          >
            {a}
          </Link>
        ))}
      </div>
      <form method="get" action="/events" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {appFilter ? (
          <input type="hidden" name="app" value={appFilter} />
        ) : null}
        <label htmlFor="event-name-filter" className="card__label">
          Filter by event name:
        </label>
        <input
          id="event-name-filter"
          type="text"
          name="name"
          defaultValue={nameFilter}
          placeholder="e.g. page_view"
          style={{
            minHeight: 44,
            padding: "0 8px",
            fontSize: 16,
            border: "1px solid var(--color-border)",
            borderRadius: 4,
          }}
        />
        <button
          type="submit"
          style={{
            minHeight: 44,
            padding: "0 16px",
            fontSize: 16,
            cursor: "pointer",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            background: "var(--color-surface)",
          }}
        >
          Apply
        </button>
      </form>
    </div>
  );
}
