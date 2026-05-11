"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * After App Router client navigation, the browser does not always scroll to the URL hash.
 * Run after route changes so in-app links to `#id` land on the right section.
 */
export function ScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pathname]);

  return null;
}
