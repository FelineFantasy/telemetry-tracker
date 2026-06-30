export function ListResultCount({
  total,
  noun = "results",
}: {
  total: number;
  noun?: string;
}) {
  return (
    <p className="mb-4 font-mono text-[13px] text-muted-foreground" role="status" aria-live="polite">
      <span className="text-foreground tabular-nums">{total.toLocaleString()}</span> {noun}
    </p>
  );
}
