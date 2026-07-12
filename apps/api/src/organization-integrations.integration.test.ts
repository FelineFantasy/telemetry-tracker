import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { OrgRole } from "@prisma/client";
import { createApp } from "./app.js";
import { hashPassword } from "./lib/password.js";
import { prisma } from "./lib/db.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("Organization integrations (integration)", () => {
  let app: FastifyInstance | undefined;
  let organizationId: string;
  let projectId: string;
  let ownerEmail: string;
  let outsiderEmail: string;
  const password = "testpass12";

  beforeAll(async () => {
    const suffix = randomBytes(8).toString("hex");
    ownerEmail = `integrations-owner-${suffix}@test.local`;
    outsiderEmail = `integrations-outsider-${suffix}@test.local`;

    const org = await prisma.organization.create({
      data: { name: `Integrations org ${suffix}` },
    });
    organizationId = org.id;

    const project = await prisma.project.create({
      data: {
        organization_id: org.id,
        name: "Integrations project",
        slug: `integrations-${suffix}`,
      },
    });
    projectId = project.id;

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
        email: outsiderEmail,
        password_hash: hashPassword(password),
      },
    });

    app = await createApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string): Promise<string> {
    const res = await app!.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === "tt_session");
    expect(cookie?.value).toBeTruthy();
    return `tt_session=${cookie!.value}`;
  }

  it("GET /api/meta/organizations/:orgId/integrations returns catalog for org members", async () => {
    const cookie = await login(ownerEmail);
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/integrations`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      organizationId: string;
      integrations: { id: string; status: string }[];
    };
    expect(body.organizationId).toBe(organizationId);
    expect(body.integrations.some((i) => i.id === "sdk")).toBe(true);
    expect(body.integrations.find((i) => i.id === "sdk")?.status).toBe("disconnected");
    expect(body.integrations.find((i) => i.id === "slack")?.status).toBe("disconnected");
  });

  it("GET integrations marks SDK connected when org has active API keys", async () => {
    const suffix = randomBytes(4).toString("hex");
    const { createProjectApiKey } = await import("./lib/create-project-api-key.js");
    const created = await createProjectApiKey(prisma, projectId, { name: `Key ${suffix}` });
    expect(created.ok).toBe(true);

    const cookie = await login(ownerEmail);
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/integrations`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { integrations: { id: string; status: string }[] };
    expect(body.integrations.find((i) => i.id === "sdk")?.status).toBe("connected");
  });

  it("GET integrations returns 403 for non-members", async () => {
    const cookie = await login(outsiderEmail);
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/integrations`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET integrations returns 401 without session", async () => {
    const res = await app!.inject({
      method: "GET",
      url: `/api/meta/organizations/${organizationId}/integrations`,
    });
    expect(res.statusCode).toBe(401);
  });
});
