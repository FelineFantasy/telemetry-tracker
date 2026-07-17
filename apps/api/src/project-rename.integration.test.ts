import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { OrgRole } from "@prisma/client";
import { createApp } from "./app.js";
import { hashPassword } from "./lib/password.js";
import { prisma } from "./lib/db.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("Project rename (integration)", () => {
  let app: FastifyInstance | undefined;
  let organizationId: string;
  let projectId: string;
  let otherProjectId: string;
  let ownerEmail: string;
  let editorEmail: string;
  let viewerEmail: string;
  const password = "testpass12";
  const suffix = randomBytes(8).toString("hex");

  beforeAll(async () => {
    ownerEmail = `proj-rename-owner-${suffix}@test.local`;
    editorEmail = `proj-rename-editor-${suffix}@test.local`;
    viewerEmail = `proj-rename-viewer-${suffix}@test.local`;

    const org = await prisma.organization.create({
      data: {
        name: `Project rename org ${suffix}`,
        projects: {
          create: [
            {
              name: `Rename project ${suffix}`,
              slug: `rename-proj-${suffix}`,
            },
            {
              name: `Other project ${suffix}`,
              slug: `other-proj-${suffix}`,
            },
          ],
        },
      },
      include: { projects: true },
    });
    organizationId = org.id;
    projectId = org.projects.find((p) => p.slug === `rename-proj-${suffix}`)!.id;
    otherProjectId = org.projects.find((p) => p.slug === `other-proj-${suffix}`)!.id;

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

  async function patchProject(
    sessionId: string,
    id: string,
    body: unknown
  ) {
    return app!.inject({
      method: "PATCH",
      url: `/api/meta/projects/${id}`,
      headers: {
        authorization: `Bearer ${sessionId}`,
        "content-type": "application/json",
      },
      payload: body,
    });
  }

  it("OWNER can rename a project and receives the updated name and slug", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const nextName = `Renamed project ${suffix}`;
    const nextSlug = `renamed-proj-${suffix}`;
    const res = await patchProject(sessionId, projectId, {
      name: nextName,
      slug: nextSlug,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      id: string;
      name: string;
      slug: string;
      organizationId: string;
    };
    expect(body).toEqual({
      id: projectId,
      name: nextName,
      slug: nextSlug,
      organizationId,
    });

    const row = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true, slug: true },
    });
    expect(row).toEqual({ name: nextName, slug: nextSlug });
  });

  it("EDITOR receives 403 when renaming a project", async () => {
    const sessionId = await loginSessionId(editorEmail);
    const res = await patchProject(sessionId, projectId, {
      name: `Editor rename ${suffix}`,
    });
    expect(res.statusCode).toBe(403);
  });

  it("VIEWER receives 403 when renaming a project", async () => {
    const sessionId = await loginSessionId(viewerEmail);
    const res = await patchProject(sessionId, projectId, {
      name: `Viewer rename ${suffix}`,
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects missing or empty name/slug with 400", async () => {
    const sessionId = await loginSessionId(ownerEmail);

    const missing = await patchProject(sessionId, projectId, {});
    expect(missing.statusCode).toBe(400);
    expect((missing.json() as { error: string }).error).toMatch(/name or slug/i);

    const emptyName = await patchProject(sessionId, projectId, { name: "   " });
    expect(emptyName.statusCode).toBe(400);
    expect((emptyName.json() as { error: string }).error).toMatch(/empty/i);

    const emptySlug = await patchProject(sessionId, projectId, { slug: "   " });
    expect(emptySlug.statusCode).toBe(400);
    expect((emptySlug.json() as { error: string }).error).toMatch(/empty/i);
  });

  it("returns 400 for an invalid project id", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const res = await patchProject(sessionId, "not-a-uuid", {
      name: "Whatever",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a soft-deleted project", async () => {
    const deleted = await prisma.project.create({
      data: {
        organization_id: organizationId,
        name: `Deleted project ${suffix}`,
        slug: `deleted-proj-${suffix}`,
        deleted_at: new Date(),
      },
    });

    try {
      const sessionId = await loginSessionId(ownerEmail);
      const res = await patchProject(sessionId, deleted.id, {
        name: "Should not apply",
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await prisma.project.delete({ where: { id: deleted.id } }).catch(() => {});
    }
  });

  it("returns 404 for a missing project id", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const res = await patchProject(sessionId, randomUUID(), {
      name: "Ghost project",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 when the slug is already taken in the organization", async () => {
    const sessionId = await loginSessionId(ownerEmail);
    const other = await prisma.project.findUniqueOrThrow({
      where: { id: otherProjectId },
      select: { slug: true },
    });
    const res = await patchProject(sessionId, projectId, {
      slug: other.slug,
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error: string }).error).toMatch(/slug/i);
  });
});
