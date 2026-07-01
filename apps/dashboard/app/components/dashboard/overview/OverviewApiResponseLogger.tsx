"use client";

import { useEffect, useRef } from "react";
import type { OverviewApiResponse } from "@/lib/overview-api";

/** Dev-only: logs GET /api/overview payload in the browser console. */
export function OverviewApiResponseLogger({ data }: { data: OverviewApiResponse }) {
  const loggedKey = useRef<string | null>(null);

  useEffect(() => {
    const enabled =
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_DASHBOARD_DEBUG === "1";
    if (!enabled) return;

    const key = [
      data.range,
      data.since,
      data.errorsLast24h,
      data.eventsLast24h,
      data.topErrorGroups?.length ?? 0,
      data.topEvents?.length ?? 0,
    ].join(":");

    if (loggedKey.current === key) return;
    loggedKey.current = key;

    console.log("[overview] GET /api/overview response", data);
  }, [data]);

  return null;
}
