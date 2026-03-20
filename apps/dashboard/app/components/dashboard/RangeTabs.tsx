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
    <nav className="range-tabs" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
