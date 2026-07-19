/** Response slice from GET /api/overview used by the Overview page. */

export type OverviewTimeSeriesPoint = {
  t: string;
  count: number;
};

export type OverviewSeries = {
  bucket: "hour" | "day" | "week";
  errors: OverviewTimeSeriesPoint[];
  events: OverviewTimeSeriesPoint[];
  sessions?: OverviewTimeSeriesPoint[];
};

export type OverviewKpiSparklines = {
  errors: OverviewTimeSeriesPoint[];
  events: OverviewTimeSeriesPoint[];
  sessions: OverviewTimeSeriesPoint[];
};

export type OverviewRequestMetrics =
  | { available: false }
  | {
      available: true;
      avgResponseMs: number;
      avgResponseMsPrevious: number | null;
      apdex: number;
      apdexPrevious: number | null;
      requestCount: number;
      sparklines: {
        avgResponseMs: Array<{ t: string; count: number | null }>;
        apdexPct: Array<{ t: string; count: number | null }>;
      };
    };

export type OverviewRecentSession = {
  id: string;
  session_id: string;
  app: string;
  user_id: string | null;
  anonymous_id: string | null;
  user_email: string | null;
  started_at: string;
  duration_sec: number;
  event_count: number;
  status: "healthy" | "warning";
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
  metricsSince?: string;
  metricsUntil?: string;
  metricsDurationMs?: number;
  bucket?: "hour" | "day" | "week";
  compare?:
    | "previous"
    | "week-ago"
    | "today-yesterday"
    | "week"
    | "month"
    | "custom";
  compareLabel?: string;
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
  kpiSparklines?: OverviewKpiSparklines;
  requestMetrics?: OverviewRequestMetrics;
  recentSessions?: OverviewRecentSession[];
  /** Top error groups scoped to the metrics window (breakdown grid). */
  metricsTopErrorGroups?: Array<{
    id: string;
    message: string;
    app: string;
    occurrences: number;
    last_seen: string;
  }>;
};

export type OverviewWorkspaceStats = {
  projects: { count: number; detail: string };
  organizations: { count: number; detail: string };
};
