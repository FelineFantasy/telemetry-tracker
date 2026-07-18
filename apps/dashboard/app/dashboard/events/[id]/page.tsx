import { PageTitle } from "@/app/components/PageTitle";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { NavBack } from "@/app/components/dashboard/NavBack";
import { DetailMetaItem, DetailMetaPanel } from "@/app/components/dashboard/DetailMetaPanel";
import { JsonContextView } from "@/app/components/dashboard/JsonContextView";
import { TimeAgo } from "@/app/components/TimeAgo";
import { formatRelativeTime } from "@/lib/format-time";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { parseDashboardApiResourceId } from "@/lib/dashboard-api-url";

type EventDetail = {
  id: string;
  name: string;
  app: string;
  platform?: string | null;
  environment?: string | null;
  release?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  anonymous_id?: string | null;
  sdk_version?: string | null;
  properties?: unknown;
  created_at: string;
};

async function getEvent(rawId: string): Promise<EventDetail | null> {
  const id = parseDashboardApiResourceId(rawId);
  if (!id) return null;
  const res = await dashboardApiFetch(`/api/events/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ app?: string }>;
}) {
  const { id } = await params;
  const { app } = await searchParams;
  const appQuery = app?.trim() ? `?app=${encodeURIComponent(app)}` : "";

  let event: EventDetail | null;
  try {
    event = await getEvent(id);
  } catch (e) {
    return (
      <>
        <PageTitle title="Event" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  if (!event) {
    return (
      <>
        <PageTitle title="Event not found" />
        <EmptyState title="Not found" message="This event could not be found." />
      </>
    );
  }

  const identity = event.user_id ?? event.anonymous_id ?? null;
  const context = [event.app, `created ${formatRelativeTime(event.created_at)}`].join(" · ");

  const hasProperties =
    event.properties != null &&
    typeof event.properties === "object" &&
    Object.keys(event.properties as object).length > 0;

  return (
    <>
      <NavBack href={`/dashboard/events${appQuery}`}>Events</NavBack>
      <PageTitle title={event.name} context={context} />

      <div className="space-y-6">
        <DetailMetaPanel title="Details">
          <DetailMetaItem label="App" value={event.app} />
          <DetailMetaItem label="Platform" value={event.platform} />
          <DetailMetaItem label="Environment" value={event.environment} />
          <DetailMetaItem label="Release" value={event.release} />
          <DetailMetaItem label="Identity" value={identity} />
          <DetailMetaItem label="Session ID" value={event.session_id} />
          <DetailMetaItem label="SDK version" value={event.sdk_version} />
          <DetailMetaItem label="Created" value={<TimeAgo iso={event.created_at} />} />
        </DetailMetaPanel>

        {hasProperties ? (
          <JsonContextView data={event.properties} title="Properties" />
        ) : (
          <p className="text-sm text-muted-foreground">No properties recorded for this event.</p>
        )}
      </div>
    </>
  );
}
