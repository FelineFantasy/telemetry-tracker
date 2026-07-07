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
  chartWindow: {
    since: string;
    until: string;
  };
  bucket: "hour" | "day" | "week";
  stacked: ErrorsStackedPoint[];
  topTypes: ErrorsTopTypeRow[];
};

function stackedChartRangeLabel(analytics: ErrorsAnalyticsData): string {
  if (analytics.chartWindow.since === analytics.window.since) {
    return analytics.window.label;
  }
  return `${analytics.window.label} (recent chart)`;
}

export function ErrorsAnalyticsPanels({ analytics }: { analytics: ErrorsAnalyticsData }) {
  const chartRangeLabel = stackedChartRangeLabel(analytics);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <ErrorsStackedChart
        data={analytics.stacked}
        bucket={analytics.bucket}
        rangeLabel={chartRangeLabel}
      />
      <ErrorsTopTypesPanel rows={analytics.topTypes} rangeLabel={analytics.window.label} />
    </section>
  );
}
