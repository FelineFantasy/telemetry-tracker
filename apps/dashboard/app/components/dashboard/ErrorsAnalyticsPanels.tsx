"use client";

import {
  ErrorsStackedChart,
  type ErrorsStackedPoint,
} from "@/app/components/dashboard/ErrorsStackedChart";
import {
  ErrorsTopTypesPanel,
  type ErrorsTopTypeRow,
} from "@/app/components/dashboard/ErrorsTopTypesPanel";

export type ErrorsAnalyticsData = {
  window: {
    since: string;
    until: string;
    label: string;
  };
  bucket: "hour" | "day" | "week";
  stacked: ErrorsStackedPoint[];
  topTypes: ErrorsTopTypeRow[];
};

export function ErrorsAnalyticsPanels({ analytics }: { analytics: ErrorsAnalyticsData }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <ErrorsStackedChart
        data={analytics.stacked}
        bucket={analytics.bucket}
        rangeLabel={analytics.window.label}
      />
      <ErrorsTopTypesPanel rows={analytics.topTypes} rangeLabel={analytics.window.label} />
    </section>
  );
}
