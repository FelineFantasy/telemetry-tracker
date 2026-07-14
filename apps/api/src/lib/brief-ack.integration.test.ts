import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getBriefAcknowledgementRow,
  upsertBriefAcknowledgements,
} from "./brief-ack.js";
import { prisma } from "./db.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("upsertBriefAcknowledgements (integration)", () => {
  let organizationId: string;
  let projectId: string;
  let userId: string;
  const suffix = randomBytes(6).toString("hex");

  const lower = new Date("2026-07-10T12:00:00.000Z");
  const higher = new Date("2026-07-14T12:00:00.000Z");

  beforeAll(async () => {
    await prisma.$connect();
    userId = "a0000000-0000-4000-8000-000000000099";

    const user = await prisma.user.create({
      data: {
        id: userId,
        email: `brief-ack-${suffix}@example.com`,
        password_hash: "test",
      },
    });

    const org = await prisma.organization.create({
      data: {
        name: `Brief ack org ${suffix}`,
        memberships: {
          create: {
            user_id: user.id,
            role: "OWNER",
          },
        },
        projects: {
          create: {
            name: "Brief ack project",
            slug: `brief-ack-${suffix}`,
          },
        },
      },
      include: { projects: true },
    });

    organizationId = org.id;
    projectId = org.projects[0]!.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("uses GREATEST so concurrent writes cannot lower the committed watermark", async () => {
    await prisma.briefAcknowledgement.deleteMany({
      where: { user_id: userId, project_id: projectId },
    });

    const [first, second] = await Promise.all([
      upsertBriefAcknowledgements(prisma, userId, [
        { projectId, acknowledgedThrough: lower },
      ]),
      upsertBriefAcknowledgements(prisma, userId, [
        { projectId, acknowledgedThrough: higher },
      ]),
    ]);

    const row = await getBriefAcknowledgementRow(prisma, userId, projectId);
    expect(row?.acknowledged_through.toISOString()).toBe(higher.toISOString());

    const returnedValues = [
      first[0]!.acknowledgedThrough,
      second[0]!.acknowledgedThrough,
    ];
    expect(returnedValues).toContain(higher.toISOString());
    expect(Math.max(...returnedValues.map((v) => Date.parse(v)))).toBe(higher.getTime());
  });

  it("does not advance updated_at when the incoming watermark is lower", async () => {
    await prisma.briefAcknowledgement.deleteMany({
      where: { user_id: userId, project_id: projectId },
    });

    await upsertBriefAcknowledgements(prisma, userId, [
      { projectId, acknowledgedThrough: higher },
    ]);
    const afterHigher = await getBriefAcknowledgementRow(prisma, userId, projectId);
    const updatedAtAfterHigher = afterHigher!.updated_at;

    await new Promise((resolve) => setTimeout(resolve, 20));

    await upsertBriefAcknowledgements(prisma, userId, [
      { projectId, acknowledgedThrough: lower },
    ]);
    const afterLower = await getBriefAcknowledgementRow(prisma, userId, projectId);

    expect(afterLower?.acknowledged_through.toISOString()).toBe(higher.toISOString());
    expect(afterLower?.updated_at.getTime()).toBe(updatedAtAfterHigher.getTime());
  });
});
