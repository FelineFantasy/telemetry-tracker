"use client";

import { useLayoutEffect, useState } from "react";

/** Matches sidebar drawer breakpoint in globals.css (max-width: 767px). */
const MOBILE_DRAWER_MQ = "(max-width: 767px)";

export function useMobileDrawer(): boolean {
  const [isMobileDrawer, setIsMobileDrawer] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(MOBILE_DRAWER_MQ);
    const sync = () => setIsMobileDrawer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobileDrawer;
}
