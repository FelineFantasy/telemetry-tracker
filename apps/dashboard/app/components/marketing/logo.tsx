export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 9 L4 9 L6 3 L10 13 L12 7 L15 7" />
        </svg>
      </span>
      <span
        className={`truncate text-[15px] font-semibold tracking-tight ${compact ? "hidden min-[420px]:inline" : ""}`}
      >
        Telemetry<span className="text-muted-foreground"> / </span>Tracker
      </span>
    </span>
  );
}
