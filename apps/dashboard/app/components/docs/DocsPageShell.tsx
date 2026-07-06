"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, useEffect, useId, useCallback, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Footer } from "@/app/components/marketing/footer";
import { Nav } from "@/app/components/marketing/nav";
import { docsHomeAnchors, docsNavSections, type DocsNavSection } from "./docs-nav";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";
import { settingsInputClassName } from "@/lib/input-classes";

function isNavItemActive(href: string, pathname: string, hash: string): boolean {
  if (href.startsWith("/docs#")) {
    if (pathname !== "/docs" && pathname !== "/docs/") return false;
    const itemHash = href.slice("/docs".length);
    const activeHash = hash || "#introduction";
    return activeHash === itemHash;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DocsSidebarNav({
  filteredSections,
  pathname,
  hash,
  onNavigate,
}: {
  filteredSections: DocsNavSection[];
  pathname: string;
  hash: string;
  onNavigate?: () => void;
}) {
  return (
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
                    onClick={onNavigate}
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
  );
}

export function DocsPageShell({ children }: { children: ReactNode }) {
  const menuId = useId();
  const pathname = usePathname() ?? "";
  const showOnThisPage = pathname === "/docs" || pathname === "/docs/";
  const [query, setQuery] = useState("");
  const [hash, setHash] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useBodyScrollLock(sidebarOpen);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(max-width: 1023px)").matches) {
          setSidebarOpen(true);
        }
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
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

  const searchField = (
    <div className="relative">
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
        className={`${settingsInputClassName} py-2 pl-9 pr-3 sm:pr-12`}
      />
      <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
        ⌘K
      </kbd>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <div className="marketing-main-offset mx-auto max-w-7xl px-6 pt-32">
        <div className="mb-4 lg:hidden">
          <button
            type="button"
            className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
            aria-expanded={sidebarOpen}
            aria-controls={menuId}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <span className="inline-flex items-center gap-2">
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              Browse docs
            </span>
            <span className="text-xs text-muted-foreground">
              {filteredSections.reduce((n, s) => n + s.items.length, 0)} pages
            </span>
          </button>
        </div>

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close docs menu"
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
            onClick={closeSidebar}
          />
        ) : null}

        <div className="grid gap-12 lg:grid-cols-[240px_1fr_200px]">
          <aside
            className={`lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:pr-2 ${
              sidebarOpen
                ? "fixed inset-x-6 top-[7.5rem] z-50 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-lg lg:static lg:inset-auto lg:max-h-none lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
                : "hidden lg:block"
            }`}
          >
            <div className="mb-6">{searchField}</div>
            <div id={menuId}>
              <DocsSidebarNav
                filteredSections={filteredSections}
                pathname={pathname}
                hash={hash}
                onNavigate={closeSidebar}
              />
            </div>
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
