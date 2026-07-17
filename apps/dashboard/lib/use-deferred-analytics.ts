"use client";

import { useEffect, useState } from "react";
import { dashboardApiClientFetch } from "@/lib/dashboard-api-client";

type DeferredAnalyticsState<T> = {
  data: T | null;
  loading: boolean;
};

type Store<T> = {
  requestKey: string;
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
  const requestKey = queryString ? `${apiPath}?${queryString}` : apiPath;
  const [store, setStore] = useState<Store<T>>(() => ({
    requestKey,
    data: null,
    loading: true,
  }));

  // Reset synchronously when filters/scope change so we never paint stale charts
  // against a newer summary (useEffect alone runs too late).
  if (store.requestKey !== requestKey) {
    setStore({ requestKey, data: null, loading: true });
  }

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      void (async () => {
        try {
          const res = await dashboardApiClientFetch(requestKey);
          if (!res.ok) {
            if (!cancelled) {
              setStore({ requestKey, data: null, loading: false });
            }
            return;
          }
          const json = (await res.json()) as T;
          if (!cancelled) {
            setStore({ requestKey, data: json, loading: false });
          }
        } catch {
          if (!cancelled) {
            setStore({ requestKey, data: null, loading: false });
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
  }, [requestKey]);

  const matched = store.requestKey === requestKey;
  return {
    data: matched ? store.data : null,
    loading: !matched || store.loading,
  };
}
