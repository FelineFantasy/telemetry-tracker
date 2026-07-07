import { PageTitle } from "@/app/components/PageTitle";
import { Badge, ResolvedBadge } from "@/app/components/Badge";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { TimeAgo } from "@/app/components/TimeAgo";
import { NavBack } from "@/app/components/dashboard/NavBack";
import { AnalyticsSidebarRow } from "@/app/components/dashboard/analytics-ui";
import { OccurrencePanel } from "@/app/components/dashboard/DetailMetaPanel";
import { IssueDetailView } from "@/app/components/dashboard/IssueDetailView";
import { JsonContextView } from "@/app/components/dashboard/JsonContextView";
import { StackTracePanel } from "@/app/components/dashboard/StackTracePanel";
import { StackTraceView } from "@/app/components/dashboard/StackTraceView";
import { ErrorResolveButton } from "../ErrorResolveButton";
import { dashboardApiFetch } from "@/lib/dashboard-api";

type Occurrence = {
  id: string;
  created_at: string;
  stack?: string;
  symbolicated_stack?: string | null;
  symbolication_status?: "symbolicated" | "no_maps" | "no_match" | null;
  release?: string | null;
  context?: unknown;
  user_id?: string | null;
  session_id?: string | null;
  anonymous_id?: string | null;
  sdk_version?: string | null;
};

type ErrorGroup = {
  id: string;
  message: string;
  app: string;
  top_stack?: string | null;
  symbolicated_top_stack?: string | null;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  environment?: string | null;
  release?: string | null;
  resolved_at?: string | null;
  users_affected?: number | null;
  sessions_affected?: number | null;
  occurrences_list?: Occurrence[];
};

async function getErrorGroup(id: string): Promise<ErrorGroup | null> {
  const res = await dashboardApiFetch(`/api/errors/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function ErrorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ app?: string }>;
}) {
  const { id } = await params;
  const { app } = await searchParams;
  const appQuery = app?.trim() ? `?app=${encodeURIComponent(app)}` : "";

  let group: ErrorGroup | null;
  try {
    group = await getErrorGroup(id);
  } catch (e) {
    return (
      <>
        <PageTitle title="Issue detail" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }
  if (!group) {
    return (
      <>
        <PageTitle title="Issue not found" />
        <EmptyState title="Not found" message="This error group could not be found." />
      </>
    );
  }

  const resolved = Boolean(group.resolved_at);
  const hasStackTrace = Boolean(group.symbolicated_top_stack || group.top_stack);

  const stackTrace =
    group.symbolicated_top_stack ? (
      <StackTraceView
        source={group.symbolicated_top_stack}
        title="Top frame (symbolicated, newest occurrence)"
      />
    ) : group.top_stack ? (
      <StackTraceView source={group.top_stack} title="Top stack (group)" />
    ) : (
      <EmptyState
        title="No stack trace"
        message="This error group has no stack trace on record."
      />
    );

  const occurrences = group.occurrences_list?.length ? (
    <ul className="space-y-3">
      {group.occurrences_list.map((o: Occurrence) => (
        <OccurrencePanel key={o.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Occurred
              </div>
              <TimeAgo iso={o.created_at} className="text-sm font-medium" />
            </div>
            <dl className="grid gap-2 text-[12px] sm:text-right">
              {(() => {
                const uid = o.user_id ?? o.anonymous_id;
                return uid != null && uid !== "" ? (
                  <div>
                    <dt className="text-muted-foreground">Identity</dt>
                    <dd className="break-all font-mono" title={uid}>
                      {uid.length > 24 ? uid.slice(0, 24) + "\u2026" : uid}
                    </dd>
                  </div>
                ) : null;
              })()}
              {o.session_id != null && o.session_id !== "" ? (
                <div>
                  <dt className="text-muted-foreground">Session</dt>
                  <dd className="break-all font-mono text-xs" title={o.session_id}>
                    {o.session_id}
                  </dd>
                </div>
              ) : null}
              {o.release != null && o.release !== "" ? (
                <div>
                  <dt className="text-muted-foreground">Release</dt>
                  <dd>{o.release}</dd>
                </div>
              ) : null}
              {o.sdk_version != null && o.sdk_version !== "" ? (
                <div>
                  <dt className="text-muted-foreground">SDK</dt>
                  <dd>{o.sdk_version}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {o.stack ? (
            <div className="mt-4">
              <StackTracePanel
                raw={o.stack}
                symbolicated={o.symbolicated_stack}
                release={o.release ?? group.release}
                app={group.app}
                symbolicationStatus={o.symbolication_status}
              />
            </div>
          ) : null}
          {o.context != null &&
          typeof o.context === "object" &&
          Object.keys(o.context as object).length > 0 ? (
            <div className="mt-4">
              <JsonContextView data={o.context} title="Context" />
            </div>
          ) : null}
        </OccurrencePanel>
      ))}
    </ul>
  ) : (
    <EmptyState
      title="No occurrences yet"
      message="No occurrences recorded for this error group in the loaded window."
    />
  );

  return (
    <>
      <NavBack href={`/dashboard/errors${appQuery}`}>Issues</NavBack>
      <IssueDetailView
        issueId={group.id}
        title={group.message}
        resolved={resolved}
        badges={
          <>
            <Badge>{group.app}</Badge>
            {group.environment ? <Badge>{group.environment}</Badge> : null}
            {group.release ? <Badge>{group.release}</Badge> : null}
            {resolved ? <ResolvedBadge /> : null}
          </>
        }
        actions={<ErrorResolveButton errorGroupId={group.id} resolved={resolved} />}
        metrics={[
          { label: "Occurrences", value: group.occurrences.toLocaleString() },
          {
            label: "Users affected",
            value:
              group.users_affected != null
                ? group.users_affected.toLocaleString()
                : "—",
          },
          {
            label: "First seen",
            value: <TimeAgo iso={group.first_seen} />,
          },
          {
            label: "Last seen",
            value: <TimeAgo iso={group.last_seen} />,
          },
        ]}
        sidebarTags={
          <>
            <Badge>{group.app}</Badge>
            {group.environment ? <Badge>{group.environment}</Badge> : null}
            {group.release ? <Badge>{group.release}</Badge> : null}
          </>
        }
        sidebarTimestamps={
          <>
            <AnalyticsSidebarRow label="First seen">
              <TimeAgo iso={group.first_seen} />
            </AnalyticsSidebarRow>
            <AnalyticsSidebarRow label="Last seen">
              <TimeAgo iso={group.last_seen} />
            </AnalyticsSidebarRow>
            <AnalyticsSidebarRow label="Issue ID">
              <span className="font-mono text-[12px]">{group.id}</span>
            </AnalyticsSidebarRow>
          </>
        }
        stackTrace={stackTrace}
        occurrences={occurrences}
        defaultTab={hasStackTrace ? "stack" : "occurrences"}
      />
    </>
  );
}
