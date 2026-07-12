import { ErrorState } from "@/app/components/ErrorState";
import { SettingsPageHeader } from "@/app/components/dashboard/settings/SettingsPageHeader";
import { fetchOrganizationIntegrations } from "@/lib/organization-integrations";
import { getDashboardWorkspaceForRequest } from "@/lib/dashboard-workspace-request";
import { getDashboardUser } from "@/lib/dashboard-user";
import { IntegrationsSettingsClient } from "./IntegrationsSettingsClient";

export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  const [workspace, user] = await Promise.all([
    getDashboardWorkspaceForRequest(),
    getDashboardUser(),
  ]);

  if (!user) {
    return (
      <>
        <SettingsPageHeader
          title="Integrations"
          description="Sign in to manage organization integrations."
        />
        <ErrorState message="You must be signed in to view this page." />
      </>
    );
  }

  const organizationId = workspace.resolvedOrgId;
  if (organizationId === null) {
    return (
      <>
        <SettingsPageHeader
          title="Integrations"
          description="Connect Telemetry Tracker to your toolchain."
        />
        <ErrorState message="No organization selected. Create or join an organization first." />
      </>
    );
  }

  const loaded = await fetchOrganizationIntegrations(
    organizationId,
    workspace.effectiveProjectId || undefined
  );
  if (!loaded.ok) {
    return (
      <>
        <SettingsPageHeader
          title="Integrations"
          description="Connect Telemetry Tracker to your toolchain."
        />
        <ErrorState message={loaded.error} />
      </>
    );
  }

  return (
    <IntegrationsSettingsClient
      key={organizationId}
      organizationId={organizationId}
      integrations={loaded.integrations}
    />
  );
}
