import { AlertsClient } from "./AlertsClient";
import {
  fetchProjectAlertEvents,
  fetchProjectAlertSettings,
} from "@/lib/alert-settings-server";
import { dashboardApiFetch } from "@/lib/dashboard-api";

export const dynamic = "force-dynamic";

type SessionContext = {
  canCreateApiKey?: boolean;
};

async function loadCanEdit(): Promise<boolean> {
  const res = await dashboardApiFetch("/api/meta/session-context");
  if (!res.ok) return false;
  try {
    const data = (await res.json()) as SessionContext;
    return data.canCreateApiKey === true;
  } catch {
    return false;
  }
}

export default async function AlertsPage() {
  const [settings, events, canEdit] = await Promise.all([
    fetchProjectAlertSettings(),
    fetchProjectAlertEvents(),
    loadCanEdit(),
  ]);

  return (
    <AlertsClient
      initialSettings={settings}
      initialEvents={events}
      canEdit={canEdit}
    />
  );
}
