import { PageTitle } from "@/app/components/PageTitle";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { NavBack } from "@/app/components/dashboard/NavBack";
import { DetailMetaItem, DetailMetaPanel } from "@/app/components/dashboard/DetailMetaPanel";
import { TimeAgo } from "@/app/components/TimeAgo";
import { formatRelativeTime } from "@/lib/format-time";
import { dashboardApiFetch } from "@/lib/dashboard-api";

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
  const res = await dashboardApiFetch(`/api/sessions/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
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
        <EmptyState title="Not found" message="This session could not be found." />
      </>
    );
  }

  const identity = session.user_id ?? session.anonymous_id ?? null;
  const context = [session.app, `started ${formatRelativeTime(session.started_at)}`].join(" · ");

  return (
    <>
      <NavBack href={`/dashboard/sessions${appQuery}`}>Sessions</NavBack>
      <PageTitle title={session.session_id} context={context} />

      <DetailMetaPanel title="Details">
        <DetailMetaItem label="Session ID" value={session.session_id} />
        <DetailMetaItem label="App" value={session.app} />
        <DetailMetaItem label="Platform" value={session.platform} />
        <DetailMetaItem label="Identity" value={identity} />
        <DetailMetaItem label="SDK version" value={session.sdk_version} />
        <DetailMetaItem label="Started" value={<TimeAgo iso={session.started_at} />} />
        <DetailMetaItem
          label="Ended"
          value={session.ended_at ? <TimeAgo iso={session.ended_at} /> : null}
        />
      </DetailMetaPanel>
    </>
  );
}
