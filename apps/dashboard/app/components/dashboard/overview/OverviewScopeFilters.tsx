"use client";

import { useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import {
  FilterField,
  FilterLabel,
  FilterRow,
} from "@/app/components/dashboard/list-filters-ui";
import { mergeListQuery } from "@/lib/list-filters-url";

export function OverviewScopeFilters({
  path,
  currentParams,
  platform,
  release,
  platforms,
  releases,
}: {
  path: string;
  currentParams: Record<string, string>;
  platform: string;
  release: string;
  platforms: string[];
  releases: string[];
}) {
  const router = useRouter();
  const uid = useId().replace(/:/g, "");

  const push = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      router.push(
        mergeListQuery(path, currentParams, {
          ...updates,
          errorsPage: "1",
          eventsPage: "1",
        })
      );
    },
    [router, path, currentParams]
  );

  const platformOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "", label: "Any platform" },
      ...platforms.map((value) => ({ value, label: value })),
    ],
    [platforms]
  );

  const releaseOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "", label: "Any release" },
      ...releases.map((value) => ({ value, label: value })),
    ],
    [releases]
  );

  const platformLabelId = `ov-plat-l-${uid}`;
  const platformTriggerId = `ov-plat-t-${uid}`;
  const releaseLabelId = `ov-rel-l-${uid}`;
  const releaseTriggerId = `ov-rel-t-${uid}`;

  return (
    <FilterRow className="mb-6">
      <FilterField>
        <FilterLabel id={platformLabelId}>Platform</FilterLabel>
        <DashboardCustomSelect
          value={platform}
          options={platformOptions}
          triggerId={platformTriggerId}
          listLabelledBy={platformLabelId}
          onValueChange={(value) => push({ platform: value || null })}
        />
      </FilterField>
      <FilterField>
        <FilterLabel id={releaseLabelId}>Release</FilterLabel>
        <DashboardCustomSelect
          value={release}
          options={releaseOptions}
          triggerId={releaseTriggerId}
          listLabelledBy={releaseLabelId}
          onValueChange={(value) => push({ release: value || null })}
        />
      </FilterField>
    </FilterRow>
  );
}
