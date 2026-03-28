/** Total count above the list (not tied to pagination footer). */
export function ListResultCount({
  total,
  noun = "results",
}: {
  total: number;
  noun?: string;
}) {
  return (
    <p className="list-result-count" role="status" aria-live="polite">
      <span className="list-result-count__num">{total.toLocaleString()}</span>{" "}
      {noun}
    </p>
  );
}
