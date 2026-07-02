import { PageTitle } from "@/app/components/PageTitle";
import { Badge, ResolvedBadge } from "@/app/components/Badge";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { TimeAgo } from "@/app/components/TimeAgo";
import { NavBack } from "@/app/components/dashboard/NavBack";
import {
  DetailMetaChip,
  DetailSummaryPanel,
  OccurrencePanel,
} from "@/app/components/dashboard/DetailMetaPanel";
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

  const title =
    group.message.length > 80 ? group.message.slice(0, 80) + "\u2026" : group.message;
  const resolved = Boolean(group.resolved_at);
  const contextLine = [
    group.app,
    group.environment ? `env ${group.environment}` : null,
    group.release ? `release ${group.release}` : null,
    `${group.occurrences} occurrence${group.occurrences === 1 ? "" : "s"}`,
    resolved ? "Resolved" : "Open",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <NavBack href={`/dashboard/errors${appQuery}`}>Issues</NavBack>
      <PageTitle
        title={title}
        context={contextLine}
        actions={<ErrorResolveButton errorGroupId={group.id} resolved={resolved} />}
      />

      <div className="space-y-6">
        <DetailSummaryPanel
          title={group.message}
          badges={
            <>
              <Badge>{group.app}</Badge>
              {group.environment ? <Badge>{group.environment}</Badge> : null}
              {group.release ? <Badge>{group.release}</Badge> : null}
              {resolved ? <ResolvedBadge /> : null}
            </>
          }
          meta={
            <>
              <DetailMetaChip label="First seen">
                <TimeAgo iso={group.first_seen} />
              </DetailMetaChip>
              <DetailMetaChip label="Last seen">
                <TimeAgo iso={group.last_seen} />
              </DetailMetaChip>
              <DetailMetaChip label="Total">{group.occurrences.toLocaleString()}</DetailMetaChip>
            </>
          }
        />

        {group.symbolicated_top_stack ? (
          <StackTraceView
            source={group.symbolicated_top_stack}
            title="Top frame (symbolicated, newest occurrence)"
          />
        ) : group.top_stack ? (
          <StackTraceView source={group.top_stack} title="Top stack (group)" />
        ) : null}

        <div>
          <h2 className="mb-3 text-sm font-medium">Recent occurrences</h2>
          {group.occurrences_list?.length ? (
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
                            <dd className="font-mono" title={uid}>
                              {uid.length > 24 ? uid.slice(0, 24) + "\u2026" : uid}
                            </dd>
                          </div>
                        ) : null;
                      })()}
                      {o.session_id != null && o.session_id !== "" ? (
                        <div>
                          <dt className="text-muted-foreground">Session</dt>
                          <dd className="font-mono text-xs">{o.session_id}</dd>
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
          )}
        </div>
      </div>
    </>
  );
}
