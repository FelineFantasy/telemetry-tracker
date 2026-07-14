"use client";

import useSWR from "swr";
import { useCallback, useMemo, useState } from "react";
import { mergeListQuery } from "@/lib/list-filters-url";
import { dashboardApiClientFetch } from "@/lib/dashboard-api-client";

export type AnalyticsListQueryParams = Record<string, string>;

type UseAnalyticsListOptions<T> = {
  cacheKey: string;
  apiPath: string;
  path: string;
  initialData: T;
  initialListParams: AnalyticsListQueryParams;
  /** Full URL params (filters + list) for bookmarkable replaceState. */
  urlParams: AnalyticsListQueryParams;
};

export function useAnalyticsList<T>({
  cacheKey,
  apiPath,
  path,
  initialData,
  initialListParams,
  urlParams,
}: UseAnalyticsListOptions<T>) {
  const [listParams, setListParamsState] = useState(initialListParams);

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(listParams)) {
      if (value !== "") search.set(key, value);
    }
    return search.toString();
  }, [listParams]);

  const { data, error, isValidating } = useSWR<T>(
    [cacheKey, queryString],
    async () => {
      const res = await dashboardApiClientFetch(`${apiPath}?${queryString}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
      }
      return res.json() as Promise<T>;
    },
    {
      fallbackData: initialData,
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  const patchListQuery = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      setListParamsState((prev) => {
        const next: AnalyticsListQueryParams = { ...prev };
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === undefined || value === "") {
            delete next[key];
          } else {
            next[key] = value;
          }
        }
        const href = mergeListQuery(path, { ...urlParams, ...next }, updates);
        window.history.replaceState(null, "", href);
        return next;
      });
    },
    [path, urlParams]
  );

  return {
    data: data ?? initialData,
    error,
    isValidating,
    listParams,
    patchListQuery,
  };
}
