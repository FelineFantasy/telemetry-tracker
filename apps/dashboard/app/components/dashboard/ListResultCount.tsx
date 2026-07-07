export function ListResultCount({
  total,
  noun = "results",
  subtitle,
}: {
  total: number;
  noun?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 space-y-1">
      <p className="font-mono text-[13px] text-muted-foreground" role="status" aria-live="polite">
        <span className="text-foreground tabular-nums">{total.toLocaleString()}</span> {noun}
      </p>
      {subtitle ? (
        <p className="font-mono text-[12px] text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
