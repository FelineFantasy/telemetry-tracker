"use client";

import {
  EventsAnalyticsPanels,
  type EventsAnalyticsData,
} from "@/app/components/dashboard/EventsAnalyticsPanels";
import { DeferredAnalyticsSlot } from "@/app/components/dashboard/DeferredAnalyticsSlot";

export function DeferredEventsAnalytics({ queryString }: { queryString: string }) {
  return (
    <DeferredAnalyticsSlot<EventsAnalyticsData>
      apiPath="/api/events/analytics"
      queryString={queryString}
      Panel={EventsAnalyticsPanels}
    />
  );
}
