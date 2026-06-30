export function EmptyState({
  title,
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-surface/40 px-6 py-10 text-center"
      role="status"
    >
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
      <p className={`text-sm text-muted-foreground ${title ? "mt-1" : ""}`}>{message}</p>
    </div>
  );
}
