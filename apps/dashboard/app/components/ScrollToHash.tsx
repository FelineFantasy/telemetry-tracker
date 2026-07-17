"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function scrollToCurrentHash() {
  if (typeof window === "undefined") return;
  const id = window.location.hash.replace(/^#/, "");
  if (!id) return;
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/**
 * After App Router client navigation, the browser does not always scroll to the URL hash.
 * Re-run on pathname changes and hashchange so same-route deep links still land on the section.
 */
export function ScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    scrollToCurrentHash();
    window.addEventListener("hashchange", scrollToCurrentHash);
    return () => window.removeEventListener("hashchange", scrollToCurrentHash);
  }, [pathname]);

  return null;
}

/** Scroll to an in-page section id (e.g. after a same-pathname hash Link click). */
export function scrollToSectionId(id: string) {
  if (typeof window === "undefined" || !id) return;
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
