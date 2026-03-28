import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/pagination";

export function EventsFilter({
  appFilter,
  nameFilter,
  pageSize,
}: {
  appFilter: string;
  nameFilter: string;
  /** Preserved when applying filter so page size stays consistent (page resets via omission). */
  pageSize: number;
}) {
  return (
    <div className="filter-stack">
      <p className="filter-hint">
        Narrow by event name. App is selected in the sidebar.
      </p>
      <form method="get" action="/dashboard/events" className="filter-form">
        {appFilter ? (
          <input type="hidden" name="app" value={appFilter} />
        ) : null}
        {pageSize !== DEFAULT_LIST_PAGE_SIZE ? (
          <input type="hidden" name="pageSize" value={String(pageSize)} />
        ) : null}
        <label htmlFor="event-name-filter" className="filter-label">
          Event name
        </label>
        <input
          id="event-name-filter"
          type="text"
          name="name"
          defaultValue={nameFilter}
          placeholder="e.g. button_click, $screen"
          className="filter-input"
        />
        <button type="submit" className="filter-btn">
          Apply
        </button>
      </form>
    </div>
  );
}
