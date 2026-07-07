"use client";

import { useRouter } from "next/navigation";
import { mergeListQuery } from "@/lib/list-filters-url";

export type ChartBucket = "hour" | "day" | "week";

const BUCKET_OPTIONS: { value: ChartBucket; label: string }[] = [
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
];

export function AnalyticsChartBucketControl({
  value,
  path,
  currentParams,
}: {
  value: ChartBucket;
  path: string;
  currentParams: Record<string, string>;
}) {
  const router = useRouter();

  function setBucket(next: ChartBucket) {
    if (next === value) return;
    router.push(
      mergeListQuery(path, currentParams, {
        chartBucket: next,
      })
    );
  }

  return (
    <div
      className="inline-flex rounded-md border border-border p-0.5"
      role="group"
      aria-label="Group by"
    >
      <span className="sr-only">Group by</span>
      {BUCKET_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`rounded px-2.5 py-1 text-[12px] ${
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
          aria-pressed={value === option.value}
          onClick={() => setBucket(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
