/** GET form: applies `from` / `to` (clears preset `range` via omission). */
export function CustomDateRangeForm({
  path,
  hiddenParams,
  from,
  to,
}: {
  path: string;
  hiddenParams: Record<string, string>;
  from: string;
  to: string;
}) {
  return (
    <form method="get" action={path} className="filter-custom-dates">
      {Object.entries(hiddenParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="filter-custom-dates__field">
        <span className="filter-custom-dates__span">From</span>
        <input type="date" name="from" defaultValue={from} className="filter-input filter-input--date" />
      </label>
      <label className="filter-custom-dates__field">
        <span className="filter-custom-dates__span">To</span>
        <input type="date" name="to" defaultValue={to} className="filter-input filter-input--date" />
      </label>
      <button type="submit" className="filter-btn">
        Apply dates
      </button>
    </form>
  );
}
