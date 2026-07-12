import { ErrorState } from "@/app/components/ErrorState";
import { SettingsPageHeader } from "@/app/components/dashboard/settings/SettingsPageHeader";
import { fetchAuditLog } from "@/lib/audit-log";
import { getDashboardWorkspaceForRequest } from "@/lib/dashboard-workspace-request";
import { getDashboardUser } from "@/lib/dashboard-user";
import { AuditSettingsClient } from "./AuditSettingsClient";

export const dynamic = "force-dynamic";

export default async function AuditSettingsPage() {
  const [workspace, user] = await Promise.all([
    getDashboardWorkspaceForRequest(),
    getDashboardUser(),
  ]);

  if (!user) {
    return (
      <>
        <SettingsPageHeader
          title="Audit log"
          description="Sign in to view organization activity."
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
          title="Audit log"
          description="Organization activity for compliance and troubleshooting."
        />
        <ErrorState message="No organization selected. Create or join an organization first." />
      </>
    );
  }

  const loaded = await fetchAuditLog(organizationId);
  if (!loaded.ok) {
    return (
      <>
        <SettingsPageHeader
          title="Audit log"
          description="Organization activity for compliance and troubleshooting."
        />
        <ErrorState message={loaded.error} />
      </>
    );
  }

  return (
    <AuditSettingsClient
      organizationId={organizationId}
      initialEvents={loaded.events}
      initialNextCursor={loaded.nextCursor}
    />
  );
}
