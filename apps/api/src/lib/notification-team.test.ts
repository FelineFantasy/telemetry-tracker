import { OrgRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { buildTeamNotifications } from "./notification-team.js";

describe("buildTeamNotifications", () => {
  it("keys team join notifications by membership id so rejoins stay unread", async () => {
    const createdAt = new Date("2026-03-01T12:00:00.000Z");
    const prisma = {
      organizationInvite: {
        findMany: vi.fn(async () => []),
      },
      organizationMembership: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ organization_id: "org-1" }])
          .mockResolvedValueOnce([
            {
              id: "membership-abc",
              organization_id: "org-1",
              user_id: "user-2",
              role: OrgRole.EDITOR,
              created_at: createdAt,
              user: { email: "new@example.com", display_name: "New User" },
              organization: { name: "Acme" },
            },
          ]),
      },
    } as unknown as Parameters<typeof buildTeamNotifications>[0];

    const items = await buildTeamNotifications(
      prisma,
      "actor-1",
      "owner@example.com",
      ["org-1"]
    );

    expect(items).toEqual([
      {
        id: "team:member:membership-abc",
        type: "team",
        title: "New team member",
        body: "New User joined Acme as EDITOR.",
        occurredAt: createdAt.toISOString(),
        href: "/dashboard/settings/team",
      },
    ]);
  });

  it("keys pending invite notifications by invite id and token", async () => {
    const createdAt = new Date("2026-03-01T12:00:00.000Z");
    const prisma = {
      organizationInvite: {
        findMany: vi.fn(async () => [
          {
            id: "invite-1",
            token: "tok-new",
            role: OrgRole.EDITOR,
            created_at: createdAt,
            organization: { id: "org-1", name: "Acme" },
          },
        ]),
      },
      organizationMembership: {
        findMany: vi.fn(async () => []),
      },
    } as unknown as Parameters<typeof buildTeamNotifications>[0];

    const items = await buildTeamNotifications(
      prisma,
      "invitee-1",
      "invitee@example.com",
      []
    );

    expect(items[0]?.id).toBe("team:invite:invite-1:tok-new");
    expect(items[0]?.href).toBe("/register?invite=tok-new");
  });
});
