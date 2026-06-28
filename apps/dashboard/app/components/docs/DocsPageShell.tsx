"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { Footer } from "@/app/components/marketing/footer";
import { Nav } from "@/app/components/marketing/nav";
import { docsHomeAnchors, docsNavSections } from "./docs-nav";

function isNavItemActive(href: string, pathname: string, hash: string): boolean {
  if (href.startsWith("/docs#")) {
    if (pathname !== "/docs" && pathname !== "/docs/") return false;
    const itemHash = href.slice("/docs".length);
    const activeHash = hash || "#introduction";
    return activeHash === itemHash;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocsPageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const showOnThisPage = pathname === "/docs" || pathname === "/docs/";
  const [query, setQuery] = useState("");
  const [hash, setHash] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredSections = useMemo(
    () =>
      docsNavSections
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
        }))
        .filter((s) => s.items.length > 0),
    [query],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <div className="mx-auto max-w-7xl px-6 pt-32">
        <div className="grid gap-12 lg:grid-cols-[240px_1fr_200px]">
          <aside className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
            <div className="relative mb-6">
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs"
                className="w-full rounded-lg border border-border bg-surface/60 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:pr-12"
              />
              <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                ⌘K
              </kbd>
            </div>

            <nav className="space-y-7 text-sm" aria-label="Documentation">
              {filteredSections.map((s) => (
                <div key={s.id}>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {s.heading}
                  </p>
                  <ul className="space-y-0.5 border-l border-border">
                    {s.items.map((i) => {
                      const active = isNavItemActive(i.href, pathname, hash);
                      return (
                        <li key={i.id}>
                          <Link
                            href={i.href}
                            className={`-ml-px block border-l py-1.5 pl-4 transition-colors ${
                              active
                                ? "border-brand text-foreground"
                                : "border-transparent text-foreground/75 hover:border-foreground hover:text-foreground"
                            }`}
                          >
                            {i.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 pb-24">{children}</div>

          {showOnThisPage ? (
            <aside className="hidden lg:sticky lg:top-28 lg:block lg:h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                On this page
              </p>
              <ul className="space-y-2 text-sm">
                {docsHomeAnchors.map((i) => (
                  <li key={i.id}>
                    <a
                      href={i.href.replace("/docs", "")}
                      className="block text-foreground/65 transition-colors hover:text-foreground"
                    >
                      {i.label}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : (
            <div className="hidden lg:block" aria-hidden />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
