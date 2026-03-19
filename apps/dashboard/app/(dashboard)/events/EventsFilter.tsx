export function EventsFilter({
  appFilter,
  nameFilter,
}: {
  appFilter: string;
  nameFilter: string;
}) {
  return (
    <div className="filter-stack">
      <p className="filter-hint">
        Narrow by event name. App is selected in the sidebar.
      </p>
      <form method="get" action="/events" className="filter-form">
        {appFilter ? (
          <input type="hidden" name="app" value={appFilter} />
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
