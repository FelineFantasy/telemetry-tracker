import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { OrgRole } from "@prisma/client";
import { createApp } from "./app.js";
import { hashPassword } from "./lib/password.js";
import { prisma } from "./lib/db.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("Organization rename (integration)", () => {
  let app: FastifyInstance | undefined;
  let organizationId: string;
  let ownerEmail: string;
  let editorEmail: string;
  let viewerEmail: string;
  const password = "testpass12";
  const suffix = randomBytes(8).toString("hex");

  beforeAll(async () => {
    ownerEmail = `rename-owner-${suffix}@test.local`;
    editorEmail = `rename-editor-${suffix}@test.local`;
    viewerEmail = `rename-viewer-${suffix}@test.local`;

    const org = await prisma.organization.create({
      data: { name: `Rename org ${suffix}` },
    });
    organizationId = org.id;

    await prisma.user.create({
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
        email: editorEmail,
        password_hash: hashPassword(password),
        memberships: {
          create: { organization_id: org.id, role: OrgRole.EDITOR },
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

    app = await createApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
    }
    const emails = [ownerEmail, editorEmail, viewerEmail].filter(Boolean);
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

  async function patchOrgName(
    sessionId: string,
    orgId: string,
    body: unknown
  ) {
    return app!.inject({
      method: "PATCH",
      url: `/api/meta/organizations/${orgId}`,
      headers: {
        authorization: `Bearer ${sessionId}`,
        "content-type": "application/json",
      },
      payload: body,
    });
  }

  it("OWNER can rename an organization and receives the updated name", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const nextName = `Renamed workspace ${suffix}`;
    const res = await patchOrgName(sessionId, organizationId, { name: nextName });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string; name: string };
    expect(body).toEqual({ id: organizationId, name: nextName });

    const row = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });
    expect(row.name).toBe(nextName);
  });

  it("EDITOR receives 403 when renaming an organization", async () => {
    const sessionId = await loginSessionId(editorEmail);
    const res = await patchOrgName(sessionId, organizationId, {
      name: `Editor rename ${suffix}`,
    });
    expect(res.statusCode).toBe(403);
  });

  it("VIEWER receives 403 when renaming an organization", async () => {
    const sessionId = await loginSessionId(viewerEmail);
    const res = await patchOrgName(sessionId, organizationId, {
      name: `Viewer rename ${suffix}`,
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects missing or empty names with 400", async () => {
    const sessionId = await loginSessionId(ownerEmail);

    const missing = await patchOrgName(sessionId, organizationId, {});
    expect(missing.statusCode).toBe(400);
    expect((missing.json() as { error: string }).error).toMatch(/name/i);

    const empty = await patchOrgName(sessionId, organizationId, { name: "   " });
    expect(empty.statusCode).toBe(400);
    expect((empty.json() as { error: string }).error).toMatch(/empty/i);

    const nonString = await patchOrgName(sessionId, organizationId, {
      name: 123,
    });
    expect(nonString.statusCode).toBe(400);
  });

  it("returns 400 for an invalid organization id", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const res = await patchOrgName(sessionId, "not-a-uuid", {
      name: "Whatever",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a soft-deleted organization", async () => {
    const deletedSuffix = randomBytes(4).toString("hex");
    const deletedOrg = await prisma.organization.create({
      data: {
        name: `Deleted rename org ${deletedSuffix}`,
        deleted_at: new Date(),
      },
    });
    await prisma.organizationMembership.create({
      data: {
        organization_id: deletedOrg.id,
        user_id: (
          await prisma.user.findUniqueOrThrow({
            where: { email: ownerEmail },
            select: { id: true },
          })
        ).id,
        role: OrgRole.OWNER,
      },
    });

    try {
      const sessionId = await loginSessionId(ownerEmail);
      const res = await patchOrgName(sessionId, deletedOrg.id, {
        name: "Should not apply",
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await prisma.organization
        .delete({ where: { id: deletedOrg.id } })
        .catch(() => {});
    }
  });

  it("returns 404 for a missing organization id", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const res = await patchOrgName(sessionId, randomUUID(), {
      name: "Ghost org",
    });
    expect(res.statusCode).toBe(404);
  });
});
