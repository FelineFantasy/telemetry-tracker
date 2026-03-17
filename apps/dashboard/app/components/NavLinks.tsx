"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/errors", label: "Errors" },
  { href: "/events", label: "Events" },
  { href: "/sessions", label: "Sessions" },
  { href: "/docs", label: "Docs" },
];

export function NavLinks() {
  const pathname = usePathname() ?? "";
  return (
    <>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname === href || (href !== "/" && pathname.startsWith(href))
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </>
  );
}
