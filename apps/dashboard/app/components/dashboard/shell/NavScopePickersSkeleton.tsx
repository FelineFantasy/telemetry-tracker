export function NavScopePickersSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-9 w-24 animate-pulse rounded-md border border-border bg-surface"
        />
      ))}
    </div>
  );
}
