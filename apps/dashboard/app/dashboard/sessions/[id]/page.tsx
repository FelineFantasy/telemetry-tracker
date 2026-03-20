const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { NavBack } from "@/app/components/dashboard/NavBack";

type SessionDetail = {
  id: string;
  session_id: string;
  app: string;
  platform?: string | null;
  user_id?: string | null;
  anonymous_id?: string | null;
  sdk_version?: string | null;
  started_at: string;
  ended_at?: string | null;
};

async function getSession(id: string): Promise<SessionDetail | null> {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="event-detail__meta-row">
      <span className="event-detail__meta-label">{label}</span>
      <span className="event-detail__meta-value">{value}</span>
    </div>
  );
}

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ app?: string }>;
}) {
  const { id } = await params;
  const { app } = await searchParams;
  const appQuery = app?.trim() ? `?app=${encodeURIComponent(app)}` : "";

  let session: SessionDetail | null;
  try {
    session = await getSession(id);
  } catch (e) {
    return (
      <>
        <PageTitle title="Session" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <PageTitle title="Session not found" />
        <EmptyState message="This session could not be found." />
      </>
    );
  }

  const identity = session.user_id ?? session.anonymous_id ?? null;
  const context = [
    session.app,
    new Date(session.started_at).toLocaleString(),
  ].join(" · ");

  return (
    <>
      <NavBack href={`/dashboard/sessions${appQuery}`}>← Sessions</NavBack>
      <PageTitle title={session.session_id} context={context} />

      <div className="card event-detail__meta">
        <h2 className="event-detail__meta-title">Details</h2>
        <MetaRow label="Session ID" value={session.session_id} />
        <MetaRow label="App" value={session.app} />
        <MetaRow label="Platform" value={session.platform} />
        <MetaRow label="Identity" value={identity} />
        <MetaRow label="SDK version" value={session.sdk_version} />
        <MetaRow label="Started" value={new Date(session.started_at).toLocaleString()} />
        <MetaRow
          label="Ended"
          value={session.ended_at ? new Date(session.ended_at).toLocaleString() : null}
        />
      </div>
    </>
  );
}
