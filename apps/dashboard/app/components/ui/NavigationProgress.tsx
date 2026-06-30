"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isInternalNavigation(href: string, pathname: string): boolean {
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
    return false;
  }
  const path = href.split(/[?#]/)[0] ?? href;
  return path !== pathname;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !isInternalNavigation(href, pathname)) return;
      setActive(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[500] h-0.5 overflow-hidden bg-border"
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="navigation-progress-bar h-full bg-brand" />
    </div>
  );
}
