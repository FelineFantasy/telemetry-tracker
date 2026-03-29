import { PageTitle } from "@/app/components/PageTitle";
import { Badge } from "@/app/components/Badge";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { TimeAgo } from "@/app/components/TimeAgo";
import { NavBack } from "@/app/components/dashboard/NavBack";
import { JsonContextView } from "@/app/components/dashboard/JsonContextView";
import { StackTraceView } from "@/app/components/dashboard/StackTraceView";
import { ErrorResolveButton } from "../ErrorResolveButton";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import type { ReactNode } from "react";

type Occurrence = {
  id: string;
  created_at: string;
  stack?: string;
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
  occurrences: number;
  first_seen: string;
  last_seen: string;
  environment?: string | null;
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

function MetaChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="error-detail-meta__chip">
      <span className="error-detail-meta__chip-label">{label}</span>
      <span className="error-detail-meta__chip-value">{children}</span>
    </div>
  );
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
        <PageTitle title="Error detail" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }
  if (!group) {
    return (
      <>
        <PageTitle title="Error not found" />
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
    `${group.occurrences} occurrence${group.occurrences === 1 ? "" : "s"}`,
    resolved ? "Resolved" : "Open",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <NavBack href={`/dashboard/errors${appQuery}`}>← Errors</NavBack>
      <div className="error-detail__head">
        <PageTitle title={title} context={contextLine} />
        <div className="error-detail__actions">
          <ErrorResolveButton errorGroupId={group.id} resolved={resolved} />
        </div>
      </div>

      <section className="error-detail-summary card" aria-labelledby="error-message-heading">
        <h2 id="error-message-heading" className="error-detail-summary__message">
          {group.message}
        </h2>
        <div className="error-detail-summary__badges">
          <Badge>{group.app}</Badge>
          {group.environment ? <Badge>{group.environment}</Badge> : null}
          {resolved ? <span className="badge badge--resolved">Resolved</span> : null}
        </div>
        <div className="error-detail-meta">
          <MetaChip label="First seen">
            <TimeAgo iso={group.first_seen} />
          </MetaChip>
          <MetaChip label="Last seen">
            <TimeAgo iso={group.last_seen} />
          </MetaChip>
          <MetaChip label="Total">{group.occurrences.toLocaleString()}</MetaChip>
        </div>
      </section>

      {group.top_stack ? (
        <StackTraceView source={group.top_stack} title="Top stack (group)" />
      ) : null}

      <h2 className="section-title error-detail-occurrences-title">Recent occurrences</h2>
      {group.occurrences_list?.length ? (
        <ul className="unstyled-list error-detail-occurrence-list">
          {group.occurrences_list.map((o: Occurrence) => (
            <li key={o.id} className="occurrence-card occurrence-card--detail">
              <div className="occurrence-card__toolbar">
                <div className="occurrence-card__when">
                  <span className="occurrence-card__when-label">Occurred</span>
                  <TimeAgo iso={o.created_at} className="occurrence-card__when-rel" />
                </div>
                <dl className="occurrence-card__ids">
                  {(() => {
                    const uid = o.user_id ?? o.anonymous_id;
                    return uid != null && uid !== "" ? (
                      <div className="occurrence-card__id-row">
                        <dt>Identity</dt>
                        <dd title={uid}>{uid.length > 24 ? uid.slice(0, 24) + "\u2026" : uid}</dd>
                      </div>
                    ) : null;
                  })()}
                  {o.session_id != null && o.session_id !== "" ? (
                    <div className="occurrence-card__id-row">
                      <dt>Session</dt>
                      <dd className="font-mono text-xs">{o.session_id}</dd>
                    </div>
                  ) : null}
                  {o.sdk_version != null && o.sdk_version !== "" ? (
                    <div className="occurrence-card__id-row">
                      <dt>SDK</dt>
                      <dd>{o.sdk_version}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              {o.stack ? <StackTraceView source={o.stack} title="Stack trace" /> : null}
              {o.context != null &&
              typeof o.context === "object" &&
              Object.keys(o.context as object).length > 0 ? (
                <JsonContextView data={o.context} title="Context" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No occurrences yet"
          message="No occurrences recorded for this error group in the loaded window. Adjust filters or check back after new errors are reported."
        />
      )}
    </>
  );
}
