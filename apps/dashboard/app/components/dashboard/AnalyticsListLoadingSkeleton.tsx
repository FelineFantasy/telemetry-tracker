export function AnalyticsListLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <div className="h-24 animate-pulse rounded-xl border border-border bg-surface/30" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface/30" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-border bg-surface/30" />
    </div>
  );
}
