import { PageTitle } from "@/app/components/PageTitle";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { Table, TableWrap } from "@/app/components/ui/Table";
import { TimeAgo } from "@/app/components/TimeAgo";

export const dynamic = "force-dynamic";

type MemberRow = {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
};

async function loadMembers(): Promise<
  { ok: true; organizationId: string | null; members: MemberRow[] } | { ok: false; message: string }
> {
  const res = await dashboardApiFetch("/api/meta/members");
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: `Could not load members (${res.status}): ${t.slice(0, 200)}` };
  }
  const data = (await res.json()) as {
    organizationId: string | null;
    members: MemberRow[];
  };
  return {
    ok: true,
    organizationId: data.organizationId,
    members: data.members ?? [],
  };
}

export default async function TeamSettingsPage() {
  const loaded = await loadMembers();
  if (!loaded.ok) {
    return (
      <>
        <PageTitle title="Team" context="Members of your organization." />
        <ErrorState message={loaded.message} />
      </>
    );
  }

  return (
    <>
      <PageTitle title="Team" context="Members of your organization." />
      {loaded.members.length === 0 ? (
        <p className="text-muted-foreground">No members yet.</p>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {loaded.members.map((m) => (
                <tr key={m.userId}>
                  <td>{m.email}</td>
                  <td>{m.displayName ?? "—"}</td>
                  <td>{m.role}</td>
                  <td>
                    <TimeAgo iso={m.joinedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
