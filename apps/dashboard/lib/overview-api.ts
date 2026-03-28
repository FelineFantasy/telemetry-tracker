/** Response slice from GET /api/overview used by the Overview page. */

export type OverviewTimeSeriesPoint = {
  t: string;
  count: number;
};

export type OverviewSeries = {
  bucket: "hour" | "day";
  errors: OverviewTimeSeriesPoint[];
  events: OverviewTimeSeriesPoint[];
};

export type OverviewApiResponse = {
  range: string;
  since: string;
  errorsLast24h: number;
  eventsLast24h: number;
  errorsPrevious: number;
  eventsPrevious: number;
  topErrorGroups: Array<{
    id: string;
    message: string;
    app: string;
    occurrences: number;
    last_seen: string;
  }>;
  topEvents: Array<{
    name: string;
    count: number;
    app: string;
    platform: string | null;
    environment: string | null;
    release: string | null;
    lastSeen: string | null;
  }>;
  errorsListTotal?: number;
  eventsListTotal?: number;
  errorsPage?: number;
  eventsPage?: number;
  listPageSize?: number;
  series: OverviewSeries;
};
