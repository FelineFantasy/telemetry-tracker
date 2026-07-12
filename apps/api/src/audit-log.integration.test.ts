import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { OrgRole } from "@prisma/client";
import { createApp } from "./app.js";
import { AUDIT_ACTIONS } from "./lib/audit-log.js";
import { hashPassword } from "./lib/password.js";
import { prisma } from "./lib/db.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("Organization audit log (integration)", () => {
  let app: FastifyInstance | undefined;
  let organizationId: string;
  let ownerEmail: string;
  let viewerEmail: string;
  const password = "testpass12";

  beforeAll(async () => {
    const suffix = randomBytes(8).toString("hex");
    ownerEmail = `audit-owner-${suffix}@test.local`;
    viewerEmail = `audit-viewer-${suffix}@test.local`;

    const org = await prisma.organization.create({
      data: { name: `Audit org ${suffix}` },
    });
    organizationId = org.id;

    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        password_hash: hashPassword(password),
        memberships: {
          create: { organization_id: org.id, role: OrgRole.OWNER },
        },
      },
    });

    await prisma.user.create({
      data: {
        email: viewerEmail,
        password_hash: hashPassword(password),
        memberships: {
          create: { organization_id: org.id, role: OrgRole.VIEWER },
        },
      },
    });

    await prisma.organizationAuditEvent.create({
      data: {
        organization_id: org.id,
        actor_user_id: owner.id,
        actor_email: ownerEmail,
        action: AUDIT_ACTIONS.AUTH_LOGIN,
        target: ownerEmail,
      },
    });

    app = await createApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
    }
    const emails = [ownerEmail, viewerEmail].filter(Boolean);
    if (emails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    }
  });

  async function loginSessionId(email: string): Promise<string> {
    const login = await app!.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const { sessionId } = JSON.parse(login.body) as { sessionId: string };
    return sessionId;
  }

  it("GET /api/meta/organizations/:orgId/audit-log returns events for org members", async () => {
    const sessionId = await loginSessionId(viewerEmail);
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/audit-log`,
      headers: { authorization: `Bearer ${sessionId}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      events: { action: string; actorEmail: string }[];
      nextCursor: string | null;
    };
    expect(body.events.length).toBeGreaterThanOrEqual(1);
    const seededOwnerLogin = body.events.find(
      (e) =>
        e.action === AUDIT_ACTIONS.AUTH_LOGIN && e.actorEmail === ownerEmail
    );
    expect(seededOwnerLogin?.actorEmail).toBe(ownerEmail);
  });

  it("GET audit-log returns 403 for non-members", async () => {
    const suffix = randomBytes(4).toString("hex");
    const outsiderEmail = `audit-outsider-${suffix}@test.local`;
    await prisma.user.create({
      data: {
        email: outsiderEmail,
        password_hash: hashPassword(password),
      },
    });
    const sessionId = await loginSessionId(outsiderEmail);
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/audit-log`,
      headers: { authorization: `Bearer ${sessionId}` },
    });
    expect(res.statusCode).toBe(403);
    await prisma.user.deleteMany({ where: { email: outsiderEmail } }).catch(() => {});
  });

  it("POST /api/auth/login records auth.login audit events", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/audit-log?limit=10`,
      headers: { authorization: `Bearer ${sessionId}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { events: { action: string }[] };
    expect(body.events.some((e) => e.action === AUDIT_ACTIONS.AUTH_LOGIN)).toBe(true);
  });

  it("GET audit-log returns 401 without session", async () => {
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/audit-log`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET audit-log returns stored actor email, not current user email", async () => {
    const historicalEmail = ownerEmail;
    const updatedEmail = `audit-owner-updated-${randomBytes(4).toString("hex")}@test.local`;

    await prisma.user.update({
      where: { email: ownerEmail },
      data: { email: updatedEmail },
    });
    ownerEmail = updatedEmail;

    const sessionId = await loginSessionId(updatedEmail);
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/audit-log`,
      headers: { authorization: `Bearer ${sessionId}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      events: { action: string; actorEmail: string }[];
    };
    const historicalEvent = body.events.find(
      (e) =>
        e.action === AUDIT_ACTIONS.AUTH_LOGIN && e.actorEmail === historicalEmail
    );
    expect(historicalEvent?.actorEmail).toBe(historicalEmail);
    expect(historicalEvent?.actorEmail).not.toBe(updatedEmail);

    const currentLogin = body.events.find(
      (e) =>
        e.action === AUDIT_ACTIONS.AUTH_LOGIN && e.actorEmail === updatedEmail
    );
    expect(currentLogin?.actorEmail).toBe(updatedEmail);
  });
});
