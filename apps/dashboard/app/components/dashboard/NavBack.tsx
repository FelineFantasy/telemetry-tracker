import Link from "next/link";
import type { ReactNode } from "react";

export function NavBack({
  href,
  children,
  ariaLabel = "Back",
}: {
  href: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <nav className="nav-back" aria-label={ariaLabel}>
      <Link href={href}>{children}</Link>
    </nav>
  );
}
