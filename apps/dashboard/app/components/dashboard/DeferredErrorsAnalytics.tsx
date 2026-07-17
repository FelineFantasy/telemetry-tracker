"use client";

import {
  ErrorsAnalyticsPanels,
  type ErrorsAnalyticsData,
} from "@/app/components/dashboard/ErrorsAnalyticsPanels";
import { DeferredAnalyticsSlot } from "@/app/components/dashboard/DeferredAnalyticsSlot";

export function DeferredErrorsAnalytics({ queryString }: { queryString: string }) {
  return (
    <DeferredAnalyticsSlot<ErrorsAnalyticsData>
      apiPath="/api/errors/analytics"
      queryString={queryString}
      Panel={ErrorsAnalyticsPanels}
    />
  );
}
