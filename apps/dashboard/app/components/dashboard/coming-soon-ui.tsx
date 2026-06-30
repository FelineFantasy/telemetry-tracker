export const COMING_SOON_LABEL = "Coming soon";

export function ComingSoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-border px-1.5 py-px text-[9px] font-medium leading-none text-muted-foreground ${className}`}
      aria-label={COMING_SOON_LABEL}
    >
      {COMING_SOON_LABEL}
    </span>
  );
}

export function ComingSoonBanner() {
  return (
    <p
      className="rounded-lg border border-border bg-surface/40 px-4 py-3 text-[13px] text-muted-foreground"
      role="status"
    >
      <span className="font-medium text-foreground">{COMING_SOON_LABEL}.</span> This area is planned
      but not available yet — controls and sample data below are placeholders.
    </p>
  );
}
