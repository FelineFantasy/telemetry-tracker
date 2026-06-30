import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

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
    <nav className="mb-6" aria-label={ariaLabel}>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {children}
      </Link>
    </nav>
  );
}
