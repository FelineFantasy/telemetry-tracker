import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  DEFAULT_AUDIT_LOG_LIMIT,
  encodeAuditLogCursor,
  listOrganizationAuditEvents,
  parseAuditLogQuery,
  recordOrganizationAuditEvent,
  recordUserAuditEvents,
} from "./audit-log.js";

describe("audit-log", () => {
  it("defaults limit and accepts no cursor", () => {
    const parsed = parseAuditLogQuery({});
    expect(parsed).toEqual({ limit: DEFAULT_AUDIT_LOG_LIMIT, cursor: null });
  });

  it("parses limit and cursor", () => {
    const createdAt = new Date("2026-07-12T12:00:00.000Z");
    const id = "abc-123";
    const cursor = encodeAuditLogCursor(createdAt, id);
    const parsed = parseAuditLogQuery({ limit: "10", cursor });
    expect(parsed).toEqual({
      limit: 10,
      cursor: { createdAt, id },
    });
  });

  it("rejects invalid limit and cursor", () => {
    expect(parseAuditLogQuery({ limit: "0" })).toEqual({
      error: "limit must be between 1 and 100",
    });
    expect(parseAuditLogQuery({ cursor: "bad" })).toEqual({ error: "Invalid cursor" });
  });

  it("records audit events only for active organizations", async () => {
    let capturedMembershipWhere: unknown;
    let createManyCalled = false;
    const prisma = {
      organizationMembership: {
        findMany: async (args: { where: unknown }) => {
          capturedMembershipWhere = args.where;
          return [{ organization_id: "org-active" }];
        },
      },
      user: {
        findUnique: async () => ({ email: "actor@example.com" }),
      },
      organizationAuditEvent: {
        createMany: async () => {
          createManyCalled = true;
        },
      },
    };

    await recordUserAuditEvents(
      prisma as never,
      "user-1",
      AUDIT_ACTIONS.AUTH_LOGIN,
      "actor@example.com"
    );

    expect(capturedMembershipWhere).toEqual({
      user_id: "user-1",
      organization: { deleted_at: null },
    });
    expect(createManyCalled).toBe(true);
  });

  it("skips createMany when user has no active organization memberships", async () => {
    let createManyCalled = false;
    const prisma = {
      organizationMembership: {
        findMany: async () => [],
      },
      user: {
        findUnique: async () => ({ email: "actor@example.com" }),
      },
      organizationAuditEvent: {
        createMany: async () => {
          createManyCalled = true;
        },
      },
    };

    await recordUserAuditEvents(
      prisma as never,
      "user-1",
      AUDIT_ACTIONS.AUTH_LOGIN,
      "actor@example.com"
    );

    expect(createManyCalled).toBe(false);
  });

  it("records a single-organization audit event", async () => {
    let created: unknown;
    const prisma = {
      user: {
        findUnique: async () => ({ email: "actor@example.com" }),
      },
      organizationAuditEvent: {
        create: async (args: { data: unknown }) => {
          created = args.data;
        },
      },
    };

    await recordOrganizationAuditEvent(
      prisma as never,
      "org-1",
      "user-1",
      AUDIT_ACTIONS.PROJECT_PII_SCRUB_UPDATE,
      "project:p1 denyKeys=1 scrubSessionUserEmail=false"
    );

    expect(created).toEqual({
      organization_id: "org-1",
      actor_user_id: "user-1",
      actor_email: "actor@example.com",
      action: AUDIT_ACTIONS.PROJECT_PII_SCRUB_UPDATE,
      target: "project:p1 denyKeys=1 scrubSessionUserEmail=false",
    });
  });

  it("lists audit events with null actorUserId after user deletion", async () => {
    const createdAt = new Date("2026-07-12T12:00:00.000Z");
    const prisma = {
      organizationAuditEvent: {
        findMany: async () => [
          {
            id: "evt-1",
            created_at: createdAt,
            action: AUDIT_ACTIONS.AUTH_LOGIN,
            target: "former@example.com",
            actor_user_id: null,
            actor_email: "former@example.com",
          },
        ],
      },
    };

    const result = await listOrganizationAuditEvents(
      prisma as never,
      "org-1",
      { limit: 10, cursor: null }
    );

    expect(result.events).toEqual([
      {
        id: "evt-1",
        createdAt: createdAt.toISOString(),
        actorUserId: null,
        actorEmail: "former@example.com",
        action: AUDIT_ACTIONS.AUTH_LOGIN,
        target: "former@example.com",
      },
    ]);
    expect(result.nextCursor).toBeNull();
  });
});
