import Link from "next/link";

export type RangeTabItem = { href: string; label: string; current: boolean };

export function RangeTabs({
  ariaLabel = "Time range",
  tabs,
}: {
  ariaLabel?: string;
  tabs: RangeTabItem[];
}) {
  return (
    <nav
      className="inline-flex rounded-md border border-border bg-surface/60 p-0.5"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.current ? "page" : undefined}
          className={`rounded px-2.5 py-1 text-xs transition-colors ${
            t.current
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
