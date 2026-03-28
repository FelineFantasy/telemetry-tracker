"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SidebarLink({
  href,
  label,
  mono,
  monoIcon,
  current,
  onNavigate,
  title,
  className,
}: {
  href: string;
  label: string;
  /** Collapsed-rail abbreviation (letters). Ignored when `monoIcon` is set. */
  mono: string;
  /** Optional icon for collapsed rail — use instead of a single letter (e.g. Docs). */
  monoIcon?: ReactNode;
  current?: boolean;
  onNavigate?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("app-sidebar__link", className)}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      title={title ?? label}
    >
      <span
        className={cn("app-sidebar__link-mono", monoIcon ? "app-sidebar__link-mono--icon" : undefined)}
        aria-hidden
      >
        {monoIcon ?? mono}
      </span>
      <span className="app-sidebar__link-label">{label}</span>
    </Link>
  );
}
