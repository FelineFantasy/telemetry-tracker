"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  AlertTriangle,
  MousePointerClick,
  Package,
  Search,
  UserRound,
  BarChart3,
} from "lucide-react";
import { AnalyticsPanel, AnalyticsPanelHeader } from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { filterInputClassName } from "@/lib/input-classes";
import { cn } from "@/lib/cn";
import { useDashboardNavigation } from "@/lib/use-dashboard-navigation";
import type { DashboardListScope } from "@/lib/overview-scope-url";
import {
  buildViewAllErrorsHref,
  buildViewAllEventsHref,
  buildViewAllReleasesHref,
  buildViewAllSessionsHref,
  flattenSearchResults,
  totalSearchHitCount,
  type GlobalSearchResult,
  type GlobalSearchResultItem,
} from "@/lib/global-search";

type Props = {
  initialQuery: string;
  result: GlobalSearchResult | null;
  scope: DashboardListScope;
  /** Hidden fields preserved on form submit (app, env, range, …). */
  hiddenScope: Record<string, string>;
  loadError?: string | null;
};

const GROUP_META: Record<
  GlobalSearchResultItem["kind"],
  { label: string; icon: typeof Search }
> = {
  error: { label: "Issues", icon: AlertTriangle },
  event: { label: "Events", icon: MousePointerClick },
  session: { label: "Sessions", icon: BarChart3 },
  release: { label: "Releases", icon: Package },
  user: { label: "Users", icon: UserRound },
};

function resultSubtitle(item: GlobalSearchResultItem): string | null {
  switch (item.kind) {
    case "error":
      return item.hit.subtitle;
    case "event":
      return `${item.hit.eventCount} event${item.hit.eventCount === 1 ? "" : "s"}`;
    case "session":
      return item.hit.subtitle;
    case "release":
      return item.hit.releaseKey === "__unknown__" ? "Missing release" : null;
    case "user":
      return item.hit.subtitle;
  }
}

export function GlobalSearchClient({
  initialQuery,
  result,
  scope,
  hiddenScope,
  loadError,
}: Props) {
  const { push, isPending } = useDashboardNavigation();
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const flat = useMemo(
    () => (result && !result.emptyQuery ? flattenSearchResults(result, scope) : []),
    [result, scope]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [result?.q, result?.emptyQuery, flat.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(hiddenScope)) {
        if (v) params.set(k, v);
      }
      const trimmed = query.trim();
      if (trimmed) params.set("q", trimmed);
      const qs = params.toString();
      push(qs ? `/dashboard/search?${qs}` : "/dashboard/search");
    },
    [hiddenScope, push, query]
  );

  const openActive = useCallback(() => {
    const item = flat[activeIndex];
    if (!item || isPending) return;
    push(item.href);
  }, [activeIndex, flat, isPending, push]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === "ArrowDown") {
        if (isPending || flat.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flat.length);
      } else if (e.key === "ArrowUp") {
        if (isPending || flat.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
      } else if (e.key === "Enter" && flat.length > 0 && !isPending) {
        // With results for the current query, Enter opens the highlighted hit
        // (including when focus is in the search input). Edited queries still submit.
        const searchedQ = (result?.q ?? initialQuery).trim();
        if (query.trim() === searchedQ) {
          e.preventDefault();
          openActive();
        }
      }
    },
    [flat.length, initialQuery, isPending, openActive, query, result?.q]
  );

  const hitCount = result ? totalSearchHitCount(result) : 0;
  const ignored = result?.parsed.ignoredKeys ?? [];

  const viewAll = result
    ? {
        errors: buildViewAllErrorsHref(result.q, scope, result.parsed.filters),
        events: buildViewAllEventsHref(result.q, scope, result.parsed.filters),
        sessions: buildViewAllSessionsHref(result.q, scope, result.parsed.filters),
        releases: buildViewAllReleasesHref(scope, result.parsed.filters),
      }
    : null;

  const groups: Array<{
    kind: GlobalSearchResultItem["kind"];
    items: GlobalSearchResultItem[];
    truncated: boolean;
    viewAllHref: string | null;
  }> = [];

  if (result && !result.emptyQuery) {
    const byKind = {
      error: flat.filter((i) => i.kind === "error"),
      event: flat.filter((i) => i.kind === "event"),
      session: flat.filter((i) => i.kind === "session"),
      release: flat.filter((i) => i.kind === "release"),
      user: flat.filter((i) => i.kind === "user"),
    };
    const order: GlobalSearchResultItem["kind"][] = [
      "error",
      "event",
      "session",
      "release",
      "user",
    ];
    for (const kind of order) {
      const items = byKind[kind];
      if (items.length === 0) continue;
      const truncated =
        kind === "error"
          ? result.groups.errors.truncated
          : kind === "event"
            ? result.groups.events.truncated
            : kind === "session"
              ? result.groups.sessions.truncated
              : kind === "release"
                ? result.groups.releases.truncated
                : result.groups.users.truncated;
      const viewAllHref =
        kind === "error"
          ? viewAll?.errors ?? null
          : kind === "event"
            ? viewAll?.events ?? null
            : kind === "session"
              ? viewAll?.sessions ?? null
              : kind === "release"
                ? viewAll?.releases ?? null
                : viewAll?.sessions ?? null;
      groups.push({ kind, items, truncated, viewAllHref });
    }
  }

  let flatOffset = 0;

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      <AnalyticsPanel>
        <AnalyticsPanelHeader
          title="Search"
          description="Find issues, events, sessions, releases, and users in this project. Use free text or key:value filters (environment, release, browser, country, device, platform, error, user, range)."
        />
        <form onSubmit={onSubmit} className="flex flex-col gap-3 px-4 py-4 sm:px-5" role="search">
          {Object.entries(hiddenScope).map(([k, v]) =>
            v ? <input key={k} type="hidden" name={k} value={v} /> : null
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="search"
                name="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="checkout environment:production release:v1.4.0"
                className={cn(filterInputClassName, "w-full pl-9")}
                aria-label="Global search query"
                autoComplete="off"
                disabled={isPending}
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border bg-background px-4 text-[13px] font-medium text-foreground hover:border-border-strong disabled:opacity-60"
            >
              Search
            </button>
          </div>
          {ignored.length > 0 ? (
            <p className="text-[12px] text-muted-foreground" role="status">
              Ignored unsupported filters:{" "}
              {ignored.map((k) => `${k}:…`).join(", ")}. Supported keys: environment, release,
              browser, country, device, platform, error, user, from, to, range.
            </p>
          ) : null}
        </form>
      </AnalyticsPanel>

      {loadError ? (
        <EmptyState title="Search failed" message={loadError} />
      ) : !result ? (
        <EmptyState
          title="Search this project"
          message="Enter a query to search across issues, events, sessions, releases, and users. Tip: combine free text with filters like environment:production."
        />
      ) : result.emptyQuery ? (
        initialQuery.trim() ? (
          <EmptyState
            title="Nothing searchable"
            message={`“${initialQuery.trim()}” has no free text or supported filters. Use plain terms or keys like environment:, release:, browser:, country:, device:, platform:, error:, user:, from:, to:, or range:.`}
          />
        ) : (
          <EmptyState
            title="Search this project"
            message="Enter a query to search across issues, events, sessions, releases, and users. Tip: combine free text with filters like environment:production."
          />
        )
      ) : hitCount === 0 ? (
        <EmptyState
          title="No matches"
          message={`Nothing matched “${result.q}” in the current project scope. Try fewer filters or a broader time range.`}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-[12px] text-muted-foreground">
            Showing up to {result.limitPerGroup} matches per group. Use ↑↓ and Enter to open a
            result.
          </p>
          {groups.map((group) => {
            const meta = GROUP_META[group.kind];
            const Icon = meta.icon;
            const startIndex = flatOffset;
            flatOffset += group.items.length;
            return (
              <AnalyticsPanel key={group.kind}>
                <AnalyticsPanelHeader
                  title={meta.label}
                  description={
                    group.truncated
                      ? `Top ${group.items.length} matches (more available)`
                      : `${group.items.length} match${group.items.length === 1 ? "" : "es"}`
                  }
                  action={
                    group.viewAllHref ? (
                      <Link
                        href={group.viewAllHref}
                        className="text-[12px] text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault();
                          if (!isPending) push(group.viewAllHref!);
                        }}
                      >
                        View all
                      </Link>
                    ) : null
                  }
                />
                <ul className="divide-y divide-border" role="listbox" aria-label={meta.label}>
                  {group.items.map((item, i) => {
                    const index = startIndex + i;
                    const active = index === activeIndex;
                    const subtitle = resultSubtitle(item);
                    return (
                      <li key={`${item.kind}-${item.href}-${i}`} role="option" aria-selected={active}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left sm:px-5",
                            active
                              ? "bg-surface text-foreground"
                              : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                          )}
                          onMouseEnter={() => {
                            if (!isPending) setActiveIndex(index);
                          }}
                          onClick={() => {
                            if (!isPending) push(item.href);
                          }}
                          disabled={isPending}
                        >
                          <Icon
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">
                              {item.hit.title}
                            </span>
                            {subtitle ? (
                              <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                                {subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </AnalyticsPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
