import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  DEFAULT_AUDIT_LOG_LIMIT,
  encodeAuditLogCursor,
  parseAuditLogQuery,
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
});
