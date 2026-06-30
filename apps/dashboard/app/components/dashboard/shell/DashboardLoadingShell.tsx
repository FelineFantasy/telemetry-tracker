export function DashboardLoadingShell() {
  return (
    <div className="min-h-screen bg-background text-foreground" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="h-7 w-28 animate-pulse rounded-md bg-surface" />
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-24 animate-pulse rounded-md border border-border bg-surface" />
            ))}
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-8 animate-pulse rounded-md border border-border bg-surface" />
            ))}
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 border-t border-border/60 px-4 py-2 sm:px-6 lg:px-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-16 animate-pulse rounded-md bg-surface" />
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <div className="h-9 w-64 max-w-full animate-pulse rounded-md bg-surface" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        <div className="mb-6 h-40 animate-pulse rounded-xl border border-border bg-surface" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      </main>
    </div>
  );
}
