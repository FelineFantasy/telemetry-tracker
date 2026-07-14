"use client";

import useSWR from "swr";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeDashboardUrlParams, mergeListQuery } from "@/lib/list-filters-url";
import { dashboardApiClientFetch } from "@/lib/dashboard-api-client";

export type AnalyticsListQueryParams = Record<string, string>;

type UseAnalyticsListOptions<T> = {
  cacheKey: string;
  apiPath: string;
  path: string;
  initialData: T;
  initialListParams: AnalyticsListQueryParams;
  /** Full URL params (filters + list) for bookmarkable history updates. */
  urlParams: AnalyticsListQueryParams;
};

/** List params mirrored in the dashboard URL (omitted values use API defaults). */
const URL_LIST_KEYS = new Set(["page", "pageSize", "sort", "order"]);

function serializeListParams(params: AnalyticsListQueryParams): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function listParamsFromPopState(
  prev: AnalyticsListQueryParams,
  initialListParams: AnalyticsListQueryParams,
  urlParams: AnalyticsListQueryParams,
  keys: string[],
  search: string
): AnalyticsListQueryParams {
  const sp = new URLSearchParams(search);
  const next: AnalyticsListQueryParams = {};

  for (const key of keys) {
    if (sp.has(key)) {
      const value = sp.get(key);
      if (value !== null && value !== "") next[key] = value;
      continue;
    }

    if (URL_LIST_KEYS.has(key)) {
      continue;
    }

    const urlBacked = Object.prototype.hasOwnProperty.call(urlParams, key);
    if (urlBacked) {
      continue;
    }

    const preserved = prev[key] ?? initialListParams[key];
    if (preserved !== undefined && preserved !== "") {
      next[key] = preserved;
    }
  }

  return next;
}

export function useAnalyticsList<T>({
  cacheKey,
  apiPath,
  path,
  initialData,
  initialListParams,
  urlParams,
}: UseAnalyticsListOptions<T>) {
  const listParamKeys = useMemo(
    () => Object.keys(initialListParams),
    [initialListParams]
  );
  const initialListParamsKey = useMemo(
    () => serializeListParams(initialListParams),
    [initialListParams]
  );
  const [listParams, setListParamsState] = useState(initialListParams);

  useEffect(() => {
    setListParamsState(initialListParams);
  }, [initialListParamsKey, initialListParams]);

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(listParams)) {
      if (value !== "") search.set(key, value);
    }
    return search.toString();
  }, [listParams]);

  useEffect(() => {
    const onPopState = () => {
      setListParamsState((prev) =>
        listParamsFromPopState(
          prev,
          initialListParams,
          urlParams,
          listParamKeys,
          window.location.search
        )
      );
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialListParams, listParamKeys, urlParams]);

  const { data, error, isValidating } = useSWR<T>(
    [cacheKey, queryString],
    async () => {
      const search = new URLSearchParams(queryString);
      if (search.has("metricsUntil")) {
        search.set("metricsUntil", new Date().toISOString());
      }
      const res = await dashboardApiClientFetch(`${apiPath}?${search.toString()}`);
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
      revalidateOnMount: false,
    }
  );

  const liveUrlParams = useMemo(
    () => mergeDashboardUrlParams(urlParams, listParams),
    [urlParams, listParams]
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
        if (serializeListParams(prev) === serializeListParams(next)) {
          return prev;
        }
        const href = mergeListQuery(
          path,
          mergeDashboardUrlParams(urlParams, next),
          updates
        );
        const currentHref = `${window.location.pathname}${window.location.search}`;
        if (href !== currentHref) {
          window.history.pushState(null, "", href);
        }
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
    liveUrlParams,
    patchListQuery,
  };
}
