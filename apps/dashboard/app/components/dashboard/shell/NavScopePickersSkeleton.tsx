export function NavScopePickersSkeleton() {
  return (
    <div className="flex w-max min-w-full items-center gap-1.5 sm:w-auto sm:min-w-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-9 w-24 shrink-0 animate-pulse rounded-md border border-border bg-surface"
        />
      ))}
    </div>
  );
}
