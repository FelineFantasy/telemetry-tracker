"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export function SidebarLink({
  href,
  label,
  mono,
  current,
  onNavigate,
  title,
  className,
}: {
  href: string;
  label: string;
  mono: string;
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
      <span className="app-sidebar__link-mono" aria-hidden>
        {mono}
      </span>
      <span className="app-sidebar__link-label">{label}</span>
    </Link>
  );
}
