/** Response slice from GET /api/overview used by the Overview page. */

export type OverviewTimeSeriesPoint = {
  t: string;
  count: number;
};

export type OverviewSeries = {
  bucket: "hour" | "day" | "week";
  errors: OverviewTimeSeriesPoint[];
  events: OverviewTimeSeriesPoint[];
};

export type OverviewHealth = {
  status: "operational" | "degraded" | "outage";
  statusLabel: string;
  subtitle: string;
  errorRatePct: number;
  errorRateDeltaPct: number;
  successRatePct: number;
  throughputPerSec: number;
  peakThroughputPerSec: number;
};

export type OverviewActiveIssue = {
  id: string;
  severity: "P1" | "P3";
  title: string;
  meta: string;
  status: string;
  href: string;
};

export type OverviewWorkspaceTelemetry = {
  ingestRequests: number;
  sdkEventRows: number;
  distinctApps: number;
  distinctSdkVersions: number;
};

export type OverviewApiResponse = {
  range: string;
  rangeLabel?: string;
  since: string;
  until?: string;
  bucket?: "hour" | "day" | "week";
  compare?: "previous" | "week-ago";
  errorsLast24h: number;
  eventsLast24h: number;
  errorsPrevious: number;
  eventsPrevious: number;
  sessionsCount?: number;
  sessionsPrevious?: number;
  activeUsers?: number;
  activeUsersPrevious?: number;
  environments?: string[];
  health?: OverviewHealth;
  activeIssues?: OverviewActiveIssue[];
  workspaceTelemetry?: OverviewWorkspaceTelemetry;
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
  sessionDurationSeries?: OverviewTimeSeriesPoint[];
};

export type OverviewWorkspaceStats = {
  projects: { count: number; detail: string };
  organizations: { count: number; detail: string };
};
