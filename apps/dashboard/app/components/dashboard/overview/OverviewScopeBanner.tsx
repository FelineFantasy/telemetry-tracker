export function OverviewScopeBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-border bg-surface/40 px-4 py-2.5 text-sm text-muted-foreground"
    >
      Showing all apps in this project.
    </div>
  );
}
