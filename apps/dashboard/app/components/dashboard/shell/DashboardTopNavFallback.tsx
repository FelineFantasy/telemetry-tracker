import { NavScopePickersSkeleton } from "./NavScopePickersSkeleton";

export function DashboardTopNavFallback() {
  return (
    <header className="sticky top-0 z-40 w-full max-w-[100vw] overflow-x-clip border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="relative z-50 mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-2 sm:px-6 lg:px-8">
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:contents">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-surface sm:order-1 sm:w-28" />
          <div className="relative z-[60] flex shrink-0 gap-1 sm:order-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-8 animate-pulse rounded-md border border-border bg-surface"
              />
            ))}
          </div>
        </div>
        <div className="min-w-0 w-full overflow-x-auto overscroll-x-contain px-0 scrollbar-hide sm:order-2 sm:w-auto sm:overflow-visible">
          <NavScopePickersSkeleton />
        </div>
      </div>
      <div className="relative z-10 mx-auto w-full min-w-0 max-w-7xl overflow-hidden border-t border-border/60 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-16 shrink-0 animate-pulse rounded-md bg-surface" />
          ))}
        </div>
      </div>
    </header>
  );
}
