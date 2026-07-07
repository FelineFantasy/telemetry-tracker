"use client";

import { TimeAgo } from "@/app/components/TimeAgo";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
  AnalyticsPanelList,
  AnalyticsViewAllLink,
  SessionStatusBadge,
} from "@/app/components/dashboard/analytics-ui";
import { Badge } from "@/app/components/Badge";
import { OverviewListItem } from "@/app/components/dashboard/IssueList";
import type { OverviewRecentSession } from "@/lib/overview-api";
import { formatDurationSec } from "@/lib/format-duration";

function sessionIdentity(row: OverviewRecentSession): string {
  const email = row.user_email?.trim();
  if (email) return email;
  const id = row.user_id ?? row.anonymous_id;
  return id ?? row.session_id;
}

export function OverviewRecentSessionsPanel({
  sessions,
  rangeLabel,
  sessionsHref,
}: {
  sessions: OverviewRecentSession[];
  rangeLabel: string;
  sessionsHref: string;
}) {
  return (
    <AnalyticsPanel aria-label="Recent sessions">
      <AnalyticsPanelHeader
        title="Recent sessions"
        description={`Latest sessions in ${rangeLabel.toLowerCase()}`}
        action={
          <AnalyticsViewAllLink href={sessionsHref}>View all</AnalyticsViewAllLink>
        }
      />
      {sessions.length ? (
        <AnalyticsPanelList>
          {sessions.map((session) => (
            <OverviewListItem
              key={session.id}
              href={`/dashboard/sessions/${session.id}`}
              title={sessionIdentity(session)}
              badges={
                <>
                  <Badge>{session.app}</Badge>
                  <SessionStatusBadge status={session.status} />
                </>
              }
              meta={
                <>
                  {formatDurationSec(session.duration_sec)} · {session.event_count} events ·{" "}
                  <TimeAgo iso={session.started_at} className="text-muted-foreground" />
                </>
              }
            />
          ))}
        </AnalyticsPanelList>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          No sessions recorded in this period.
        </p>
      )}
    </AnalyticsPanel>
  );
}

export function OverviewTopErrorsPanel({
  groups,
  rangeLabel,
  errorsHref,
  buildHref,
}: {
  groups: Array<{
    id: string;
    message: string;
    app: string;
    occurrences: number;
    last_seen: string;
  }>;
  rangeLabel: string;
  errorsHref: string;
  buildHref: (id: string) => string;
}) {
  return (
    <AnalyticsPanel aria-label="Top errors">
      <AnalyticsPanelHeader
        title="Top errors"
        description={`Highest occurrence groups in ${rangeLabel.toLowerCase()}`}
        action={
          <AnalyticsViewAllLink href={errorsHref}>View all</AnalyticsViewAllLink>
        }
      />
      {groups.length ? (
        <AnalyticsPanelList>
          {groups.map((group) => (
            <OverviewListItem
              key={group.id}
              href={buildHref(group.id)}
              title={group.message}
              titleClassName="font-medium text-destructive"
              badges={<Badge>{group.app}</Badge>}
              meta={
                <>
                  {group.occurrences.toLocaleString()} occurrences · last{" "}
                  <TimeAgo iso={group.last_seen} className="text-muted-foreground" />
                </>
              }
            />
          ))}
        </AnalyticsPanelList>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          No error groups recorded in this period.
        </p>
      )}
    </AnalyticsPanel>
  );
}
