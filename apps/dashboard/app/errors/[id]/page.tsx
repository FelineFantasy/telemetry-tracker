const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "../../components/PageTitle";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import Link from "next/link";

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
  occurrences_list?: Occurrence[];
};

async function getErrorGroup(id: string): Promise<ErrorGroup | null> {
  const res = await fetch(`${API_BASE}/api/errors/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function ErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
        <EmptyState message="This error group could not be found." />
      </>
    );
  }

  const title =
    group.message.length > 80
      ? group.message.slice(0, 80) + "\u2026"
      : group.message;
  const context = [
    group.app,
    `${group.occurrences} occurrences`,
    `First seen: ${new Date(group.first_seen).toLocaleString()}`,
    `Last seen: ${new Date(group.last_seen).toLocaleString()}`,
  ].join(" · ");

  return (
    <>
      <nav className="nav-back">
        <Link href="/errors">← Errors</Link>
      </nav>
      <PageTitle title={title} context={context} />
      <p>
        <Badge>{group.app}</Badge>
      </p>
      {group.top_stack && (
        <div className="card mt-md">
          <div className="card__label">Top stack</div>
          <pre>
            {group.top_stack}
          </pre>
        </div>
      )}

      <h2 className="section-title">Recent occurrences</h2>
      {group.occurrences_list?.length ? (
        <ul className="unstyled-list">
          {group.occurrences_list.map((o: Occurrence) => (
            <li key={o.id} className="occurrence-card">
              <div className="occurrence-card__meta">
                <strong>Time:</strong> {new Date(o.created_at).toLocaleString()}
                {(() => {
                  const id = o.user_id ?? o.anonymous_id;
                  return id != null && id !== "" ? (
                    <> · <strong>Identity:</strong> {id.length > 16 ? id.slice(0, 16) + "\u2026" : id}</>
                  ) : null;
                })()}
                {o.session_id != null && o.session_id !== "" && (
                  <> · <strong>Session:</strong> {o.session_id}</>
                )}
                {o.sdk_version != null && o.sdk_version !== "" && (
                  <> · <strong>SDK:</strong> {o.sdk_version}</>
                )}
              </div>
              {o.stack && (
                <>
                  <div className="card__label">Stack</div>
                  <pre className="occurrence-card pre">{o.stack}</pre>
                </>
              )}
              {o.context != null &&
                typeof o.context === "object" &&
                Object.keys(o.context).length > 0 && (
                  <>
                    <div className="card__label">Context</div>
                    <pre className="properties-json">
                      {JSON.stringify(o.context, null, 2)}
                    </pre>
                  </>
                )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="No occurrences listed for this error group." />
      )}
    </>
  );
}
