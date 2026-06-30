import { NavScopePickersSkeleton } from "./NavScopePickersSkeleton";

export function DashboardTopNavFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="relative z-50 mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="h-7 w-28 animate-pulse rounded-md bg-surface" />
        <NavScopePickersSkeleton />
        <div className="flex shrink-0 gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-8 animate-pulse rounded-md border border-border bg-surface"
            />
          ))}
        </div>
      </div>
      <div className="relative z-10 mx-auto flex max-w-7xl gap-1 border-t border-border/60 px-4 py-2 sm:px-6 lg:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-16 animate-pulse rounded-md bg-surface" />
        ))}
      </div>
    </header>
  );
}
