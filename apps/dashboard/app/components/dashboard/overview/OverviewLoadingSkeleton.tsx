export function OverviewLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading overview…</span>
      <div className="h-40 animate-pulse rounded-xl border border-border bg-surface/30" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-surface/30" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-surface/30" />
    </div>
  );
}
