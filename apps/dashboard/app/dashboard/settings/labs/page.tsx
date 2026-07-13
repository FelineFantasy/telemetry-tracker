import { ErrorState } from "@/app/components/ErrorState";
import { SettingsPageHeader } from "@/app/components/dashboard/settings/SettingsPageHeader";
import { fetchLabsPreferences } from "@/lib/labs-preferences";
import { getDashboardUser } from "@/lib/dashboard-user";
import { LabsSettingsClient } from "./LabsSettingsClient";

export const dynamic = "force-dynamic";

export default async function LabsSettingsPage() {
  const user = await getDashboardUser();

  if (!user) {
    return (
      <>
        <SettingsPageHeader
          title="Labs"
          description="Sign in to manage experimental features."
        />
        <ErrorState message="You must be signed in to view this page." />
      </>
    );
  }

  const preferences = await fetchLabsPreferences();

  return <LabsSettingsClient initialPreferences={preferences} />;
}
