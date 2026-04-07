"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  inviteOrganizationMemberAction,
  updateOrganizationMemberRoleAction,
} from "@/app/dashboard/actions";
import { Button } from "@/app/components/ui/Button";
import { Table, TableWrap } from "@/app/components/ui/Table";
import { TimeAgo } from "@/app/components/TimeAgo";

export type TeamMemberRow = {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
};

const ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;

export function TeamMembersClient({
  organizationId,
  members,
  currentUserId,
  canManageMembers,
  ownerCount,
}: {
  organizationId: string;
  members: TeamMemberRow[];
  currentUserId: string;
  canManageMembers: boolean;
  ownerCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  function onInvite(formData: FormData) {
    setInviteError(null);
    setInviteUrl(null);
    formData.set("organizationId", organizationId);
    startTransition(async () => {
      const r = await inviteOrganizationMemberAction(null, formData);
      if (!r.ok) {
        setInviteError(r.error);
        return;
      }
      if ("inviteUrl" in r && r.inviteUrl) {
        setInviteUrl(r.inviteUrl);
      }
      router.refresh();
    });
  }

  async function onRoleChange(userId: string, role: string) {
    setRoleError(null);
    const r = await updateOrganizationMemberRoleAction(organizationId, userId, role);
    if (!r.ok) {
      setRoleError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {canManageMembers ? (
        <section className="card p-6 max-w-lg" aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="card__label mb-4">
            Invite member
          </h2>
          <form action={onInvite} className="flex flex-col gap-3">
            <label className="text-sm text-muted-foreground" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              className="filter-input"
              placeholder="colleague@company.com"
              disabled={pending}
              autoComplete="email"
            />
            <label className="text-sm text-muted-foreground" htmlFor="invite-role">
              Role
            </label>
            <select id="invite-role" name="role" className="filter-input" disabled={pending}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {inviteError ? (
              <p className="text-sm text-destructive m-0" role="alert">
                {inviteError}
              </p>
            ) : null}
            {inviteUrl ? (
              <p className="text-sm m-0">
                Share this link to register:{" "}
                <code className="text-xs break-all">{inviteUrl}</code>
              </p>
            ) : null}
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Sending…" : "Add or invite"}
            </Button>
          </form>
        </section>
      ) : null}

      {roleError ? (
        <p className="text-sm text-destructive m-0" role="alert">
          {roleError}
        </p>
      ) : null}

      {members.length === 0 ? (
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
              {members.map((m) => {
                const isSelf = m.userId === currentUserId;
                const isOnlyOwner = m.role === "OWNER" && ownerCount <= 1;
                const canEditRole =
                  canManageMembers && !(isSelf && isOnlyOwner);
                return (
                  <tr key={m.userId}>
                    <td>{m.email}</td>
                    <td>{m.displayName ?? "—"}</td>
                    <td>
                      {canEditRole ? (
                        <select
                          className="filter-input min-h-9 py-1"
                          value={m.role}
                          aria-label={`Role for ${m.email}`}
                          onChange={(e) => onRoleChange(m.userId, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        m.role
                      )}
                    </td>
                    <td>
                      <TimeAgo iso={m.joinedAt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
