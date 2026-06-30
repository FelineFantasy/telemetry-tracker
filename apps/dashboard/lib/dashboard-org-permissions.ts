import { dashboardApiFetch } from "@/lib/dashboard-api";

export type OrgMemberRow = { userId: string; role: string };

export async function loadOrganizationMembers(
  organizationId: string
): Promise<{ ok: true; members: OrgMemberRow[] } | { ok: false }> {
  const res = await dashboardApiFetch(
    `/api/meta/members?organizationId=${encodeURIComponent(organizationId)}`,
    undefined,
    { organizationIdOverride: organizationId }
  );
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as { members?: OrgMemberRow[] };
  return { ok: true, members: data.members ?? [] };
}

/** Org owners can manage billing even when project-scoped session context is skipped or failed. */
export function resolveCanManageMembers({
  members,
  userId,
  sessionCanManageMembers,
}: {
  members: OrgMemberRow[] | null;
  userId: string | null | undefined;
  sessionCanManageMembers?: boolean;
}): boolean {
  const ownerFromRoster = Boolean(
    members && userId && members.some((m) => m.userId === userId && m.role === "OWNER")
  );
  return ownerFromRoster || sessionCanManageMembers === true;
}
