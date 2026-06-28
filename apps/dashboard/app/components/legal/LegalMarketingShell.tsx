"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Footer } from "@/app/components/marketing/footer";
import { Nav } from "@/app/components/marketing/nav";
import { legalAnchorsForPath } from "./legal-nav";

export function LegalMarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const onThisPage = legalAnchorsForPath(pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <div className="mx-auto max-w-7xl px-6 pt-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="min-w-0 max-w-2xl pb-24">{children}</div>

          {onThisPage.length > 0 ? (
            <aside className="hidden lg:sticky lg:top-28 lg:block lg:h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                On this page
              </p>
              <ul className="space-y-2 text-sm">
                {onThisPage.map((i) => (
                  <li key={i.id}>
                    <a
                      href={`#${i.id}`}
                      className="block text-foreground/65 transition-colors hover:text-foreground"
                    >
                      {i.label}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>

      <Footer />
    </div>
  );
}
