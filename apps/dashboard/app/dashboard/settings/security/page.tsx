import { ErrorState } from "@/app/components/ErrorState";
import { SettingsPageHeader } from "@/app/components/dashboard/settings/SettingsPageHeader";
import { getDashboardUser } from "@/lib/dashboard-user";
import { fetchAuthSessions } from "@/lib/security-settings";
import { SecuritySettingsClient } from "./SecuritySettingsClient";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const user = await getDashboardUser();

  if (!user) {
    return (
      <>
        <SettingsPageHeader
          title="Security"
          description="Sign in to manage password and sessions."
        />
        <ErrorState message="You must be signed in to view this page." />
      </>
    );
  }

  const sessions = await fetchAuthSessions();

  return <SecuritySettingsClient initialSessions={sessions} />;
}
