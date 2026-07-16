"use client";

import { useEffect, useState } from "react";
import { dashboardApiClientFetch } from "@/lib/dashboard-api-client";

type DeferredAnalyticsState<T> = {
  data: T | null;
  loading: boolean;
};

/**
 * Fetch optional analytics after first paint so list SSR is not blocked.
 * Soft-fails to `null` (same as SSR helpers that return null on non-OK).
 */
export function useDeferredAnalytics<T>(
  apiPath: string,
  queryString: string
): DeferredAnalyticsState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setData(null);

    const load = () => {
      void (async () => {
        try {
          const path = queryString
            ? `${apiPath}?${queryString}`
            : apiPath;
          const res = await dashboardApiClientFetch(path);
          if (!res.ok) {
            if (!cancelled) {
              setData(null);
              setLoading(false);
            }
            return;
          }
          const json = (await res.json()) as T;
          if (!cancelled) {
            setData(json);
            setLoading(false);
          }
        } catch {
          if (!cancelled) {
            setData(null);
            setLoading(false);
          }
        }
      })();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(load, { timeout: 400 });
    } else {
      timeoutId = setTimeout(load, 0);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [apiPath, queryString]);

  return { data, loading };
}
