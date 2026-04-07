import { PageTitle } from "@/app/components/PageTitle";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import { getDashboardOrganizationId } from "@/lib/dashboard-org";
import { getDashboardUser } from "@/lib/dashboard-user";
import { TeamMembersClient, type TeamMemberRow } from "./TeamMembersClient";

export const dynamic = "force-dynamic";

async function loadOrganizations(): Promise<{ id: string }[]> {
  const res = await dashboardApiFetch("/api/meta/organizations");
  if (!res.ok) return [];
  const data = (await res.json()) as { organizations?: { id: string }[] };
  return Array.isArray(data.organizations) ? data.organizations : [];
}

async function loadMembers(
  organizationId: string | null
): Promise<
  | { ok: true; organizationId: string | null; members: TeamMemberRow[] }
  | { ok: false; message: string }
> {
  const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const res = await dashboardApiFetch(`/api/meta/members${q}`);
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: `Could not load members (${res.status}): ${t.slice(0, 200)}` };
  }
  const data = (await res.json()) as {
    organizationId: string | null;
    members: TeamMemberRow[];
  };
  return {
    ok: true,
    organizationId: data.organizationId,
    members: data.members ?? [],
  };
}

export default async function TeamSettingsPage() {
  const [orgs, cookieOrg, user, capabilities] = await Promise.all([
    loadOrganizations(),
    getDashboardOrganizationId(),
    getDashboardUser(),
    getDashboardSessionContext(),
  ]);

  const orgIdSet = new Set(orgs.map((o) => o.id));
  const requestedOrg =
    cookieOrg && orgIdSet.has(cookieOrg) ? cookieOrg : orgs[0]?.id ?? null;

  const loaded = await loadMembers(requestedOrg);

  if (!loaded.ok) {
    return (
      <>
        <PageTitle title="Team" context="Members of your organization." />
        <ErrorState message={loaded.message} />
      </>
    );
  }

  const organizationId = loaded.organizationId;
  const members = loaded.members;
  const canManageMembers = Boolean(capabilities?.canManageMembers);
  const ownerCount = members.filter((m) => m.role === "OWNER").length;

  return (
    <>
      <PageTitle title="Team" context="Members of your organization." />
      {organizationId && user ? (
        <TeamMembersClient
          organizationId={organizationId}
          members={members}
          currentUserId={user.id}
          canManageMembers={canManageMembers}
          ownerCount={ownerCount}
        />
      ) : (
        <p className="text-muted-foreground">Join an organization to see members.</p>
      )}
    </>
  );
}
