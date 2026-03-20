"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const docLinks = [
  { href: "/docs", label: "Introduction" },
  { href: "/docs/nextjs", label: "Next.js" },
  { href: "/docs/nuxt", label: "Nuxt" },
  { href: "/docs/node", label: "Node.js" },
  { href: "/docs/react-native", label: "React Native" },
];

export function DocSidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="docs-sidebar">
      <p className="docs-sidebar-title">Documentation</p>
      <nav aria-label="Docs">
        {docLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
