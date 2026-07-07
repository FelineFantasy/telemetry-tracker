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
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <EventsVolumeChart
        data={analytics.volume}
        bucket={analytics.bucket}
        rangeLabel={chartRangeLabel}
      />
      <div className="grid gap-4">
        <EventsTopEventsPanel rows={analytics.topEvents} rangeLabel={analytics.window.label} />
        <EventsPlatformDonut slices={analytics.platforms} rangeLabel={analytics.window.label} />
      </div>
    </section>
  );
}
