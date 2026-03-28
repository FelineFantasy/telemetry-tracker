const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { NavBack } from "@/app/components/dashboard/NavBack";
import { JsonContextView } from "@/app/components/dashboard/JsonContextView";
import { TimeAgo } from "@/app/components/TimeAgo";
import { formatRelativeTime } from "@/lib/format-time";
import type { ReactNode } from "react";

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

async function getEvent(id: string): Promise<EventDetail | null> {
  const res = await fetch(`${API_BASE}/api/events/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="event-detail__meta-row">
      <span className="event-detail__meta-label">{label}</span>
      <span className="event-detail__meta-value">{value}</span>
    </div>
  );
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
      <NavBack href={`/dashboard/events${appQuery}`}>← Events</NavBack>
      <PageTitle title={event.name} context={context} />

      <div className="card event-detail__meta">
        <h2 className="event-detail__meta-title">Details</h2>
        <MetaRow label="App" value={event.app} />
        <MetaRow label="Platform" value={event.platform} />
        <MetaRow label="Environment" value={event.environment} />
        <MetaRow label="Release" value={event.release} />
        <MetaRow label="Identity" value={identity} />
        <MetaRow label="Session ID" value={event.session_id} />
        <MetaRow label="SDK version" value={event.sdk_version} />
        <MetaRow label="Created" value={<TimeAgo iso={event.created_at} />} />
      </div>

      {hasProperties && (
        <div className="card event-detail__properties mt-md">
          <JsonContextView data={event.properties} title="Properties" />
        </div>
      )}

      {!hasProperties && (
        <p className="page-context">No properties recorded for this event.</p>
      )}
    </>
  );
}
