"use client";

import {
  EventsPlatformDonut,
  type EventsPlatformSlice,
} from "@/app/components/dashboard/EventsPlatformDonut";
import {
  EventsTopEventsPanel,
  type EventsTopEventRow,
} from "@/app/components/dashboard/EventsTopEventsPanel";
import {
  EventsVolumeChart,
  type EventsVolumePoint,
} from "@/app/components/dashboard/EventsVolumeChart";

export type EventsAnalyticsData = {
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
  volume: EventsVolumePoint[];
  topEvents: EventsTopEventRow[];
  platforms: EventsPlatformSlice[];
};

function volumeChartRangeLabel(analytics: EventsAnalyticsData): string {
  if (analytics.chartWindow.since === analytics.window.since) {
    return analytics.window.label;
  }
  return `${analytics.window.label} (recent chart)`;
}

export function EventsAnalyticsPanels({ analytics }: { analytics: EventsAnalyticsData }) {
  const chartRangeLabel = volumeChartRangeLabel(analytics);

  return (
    <div className="space-y-4">
      <EventsVolumeChart
        data={analytics.volume}
        bucket={analytics.bucket}
        rangeLabel={chartRangeLabel}
      />
      <section className="grid gap-4 lg:grid-cols-2">
        <EventsTopEventsPanel rows={analytics.topEvents} rangeLabel={analytics.window.label} />
        <EventsPlatformDonut slices={analytics.platforms} rangeLabel={analytics.window.label} />
      </section>
    </div>
  );
}
