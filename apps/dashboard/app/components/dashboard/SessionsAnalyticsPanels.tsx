"use client";

import {
  SessionsPlatformDonut,
  type SessionsPlatformSlice,
} from "@/app/components/dashboard/SessionsPlatformDonut";
import {
  SessionsVolumeChart,
  type SessionsVolumePoint,
} from "@/app/components/dashboard/SessionsVolumeChart";

export type SessionsAnalyticsData = {
  window: {
    since: string;
    until: string;
    label: string;
  };
  chartWindow: {
    since: string;
    until: string;
  };
  bucket: "hour" | "day" | "week";
  volume: SessionsVolumePoint[];
  platforms: SessionsPlatformSlice[];
};

function volumeChartRangeLabel(analytics: SessionsAnalyticsData): string {
  const chartSinceMs = new Date(analytics.chartWindow.since).getTime();
  const windowSinceMs = new Date(analytics.window.since).getTime();
  if (chartSinceMs <= windowSinceMs) {
    return analytics.window.label;
  }
  return `${analytics.window.label} (recent chart)`;
}

export function SessionsAnalyticsPanels({
  analytics,
  path,
  currentParams,
}: {
  analytics: SessionsAnalyticsData;
  path: string;
  currentParams: Record<string, string>;
}) {
  const chartRangeLabel = volumeChartRangeLabel(analytics);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <SessionsVolumeChart
        data={analytics.volume}
        bucket={analytics.bucket}
        rangeLabel={chartRangeLabel}
        path={path}
        currentParams={currentParams}
      />
      <SessionsPlatformDonut
        slices={analytics.platforms}
        rangeLabel={analytics.window.label}
      />
    </section>
  );
}
