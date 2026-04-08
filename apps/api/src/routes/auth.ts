import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { OrgRole, Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { getSessionTokenFromRequest, getSessionUser } from "../lib/auth-session.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

const DEFAULT_ORG_ID =
  process.env.TELEMETRY_ORGANIZATION_ID?.trim() ||
  "a0000000-0000-4000-8000-000000000001";

const SESSION_DAYS = 30;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isStrongPassword(p: string): boolean {
  return p.length >= 8 && p.length <= 256;
}

export async function authRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.post("/auth/register", async (request, reply) => {
    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      displayName?: string;
      inviteToken?: string;
    };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim() !== ""
        ? body.displayName.trim().slice(0, 120)
        : null;
    const inviteToken =
      typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";

    if (!email.includes("@")) {
      return reply.status(400).send({ error: "Invalid email" });
    }
    if (!isStrongPassword(password)) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    if (inviteToken) {
      const inviteOutcome = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT 1 FROM "OrganizationInvite" WHERE token = ${inviteToken} FOR UPDATE`
        );
        const invite = await tx.organizationInvite.findUnique({
          where: { token: inviteToken },
        });
        if (!invite) {
          return { kind: "invalid_invite" as const };
        }
        if (invite.expires_at.getTime() <= Date.now()) {
          return { kind: "expired" as const };
        }
        if (normalizeEmail(invite.email) !== email) {
          return { kind: "email_mismatch" as const };
        }
        const existingInvitee = await tx.user.findUnique({ where: { email } });
        if (existingInvitee) {
          return { kind: "email_taken" as const };
        }
        const passwordHash = hashPassword(password);
        try {
          const u = await tx.user.create({
            data: {
              email,
              password_hash: passwordHash,
              display_name: displayName,
              memberships: {
                create: {
                  organization_id: invite.organization_id,
                  role: invite.role,
                },
              },
            },
            select: { id: true, email: true, display_name: true },
          });
          await tx.organizationInvite.delete({ where: { id: invite.id } });
          return {
            kind: "ok" as const,
            user: u,
            organizationId: invite.organization_id,
          };
        } catch (e: unknown) {
          if (
            typeof e === "object" &&
            e !== null &&
            "code" in e &&
            (e as { code: string }).code === "P2002"
          ) {
            return { kind: "email_taken" as const };
          }
          throw e;
        }
      });
      if (inviteOutcome.kind === "invalid_invite" || inviteOutcome.kind === "expired") {
        return reply.status(400).send({ error: "Invalid or expired invite" });
      }
      if (inviteOutcome.kind === "email_mismatch") {
        return reply.status(400).send({ error: "Email must match the invite" });
      }
      if (inviteOutcome.kind === "email_taken") {
        return reply.status(409).send({ error: "Email already registered" });
      }
      const user = inviteOutcome.user;

      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.userSession.create({
        data: {
          id: sessionId,
          user_id: user.id,
          expires_at: expiresAt,
        },
      });

      return reply.status(201).send({
        sessionId,
        expiresAt: expiresAt.toISOString(),
        organizationId: inviteOutcome.organizationId,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
        },
      });
    }

    const userCount = await prisma.user.count();
    const allowReg =
      process.env.TELEMETRY_ALLOW_REGISTRATION === "true" || userCount === 0;
    if (!allowReg) {
      return reply.status(403).send({ error: "Registration is disabled" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const orgMemberCount = await prisma.organizationMembership.count({
      where: { organization_id: DEFAULT_ORG_ID },
    });
    const role: OrgRole = orgMemberCount === 0 ? OrgRole.OWNER : OrgRole.VIEWER;

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashPassword(password),
        display_name: displayName,
        memberships: {
          create: {
            organization_id: DEFAULT_ORG_ID,
            role,
          },
        },
      },
      select: { id: true, email: true, display_name: true },
    });

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.userSession.create({
      data: {
        id: sessionId,
        user_id: user.id,
        expires_at: expiresAt,
      },
    });

    return reply.status(201).send({
      sessionId,
      expiresAt: expiresAt.toISOString(),
      organizationId: DEFAULT_ORG_ID,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string; password?: string };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return reply.status(400).send({ error: "email and password required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.userSession.create({
      data: {
        id: sessionId,
        user_id: user.id,
        expires_at: expiresAt,
      },
    });

    const firstMembership = await prisma.organizationMembership.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: "asc" },
      select: { organization_id: true },
    });

    return reply.send({
      sessionId,
      expiresAt: expiresAt.toISOString(),
      organizationId: firstMembership?.organization_id ?? null,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = getSessionTokenFromRequest(request);
    if (token) {
      await prisma.userSession.deleteMany({ where: { id: token } });
    }
    return reply.status(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const session = await getSessionUser(request);
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        display_name: true,
        memberships: {
          select: {
            role: true,
            organization_id: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
      memberships: user.memberships.map((m) => ({
        organizationId: m.organization_id,
        organizationName: m.organization.name,
        role: m.role,
      })),
    });
  });
}
