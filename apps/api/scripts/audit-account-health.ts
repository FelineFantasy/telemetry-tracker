/**
 * One-off audit: user / org / project / telemetry / api-key health.
 * Run: cd apps/api && pnpm exec tsx scripts/audit-account-health.ts
 */
import { prisma } from "../src/lib/db.js";

const LEGACY_ORG = "a0000000-0000-4000-8000-000000000001";
const LEGACY_PROJECT = "a0000000-0000-4000-8000-000000000002";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      display_name: true,
      created_at: true,
      _count: { select: { sessions: true, memberships: true } },
    },
    orderBy: { created_at: "asc" },
  });

  console.log("\n=== USERS ===");
  for (const u of users) {
    console.log({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      createdAt: u.created_at.toISOString(),
      sessions: u._count.sessions,
      memberships: u._count.memberships,
    });
  }

  const orgs = await prisma.organization.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
      plan_tier: true,
      created_at: true,
      _count: { select: { projects: true, memberships: true } },
    },
    orderBy: { created_at: "asc" },
  });

  console.log("\n=== ORGANIZATIONS ===");
  for (const o of orgs) {
    console.log({
      id: o.id,
      name: o.name,
      plan: o.plan_tier,
      isLegacyDefault: o.id === LEGACY_ORG,
      projects: o._count.projects,
      members: o._count.memberships,
      createdAt: o.created_at.toISOString(),
    });
  }

  const projects = await prisma.project.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
      slug: true,
      organization_id: true,
      created_at: true,
      organization: { select: { name: true } },
      _count: {
        select: {
          api_keys: true,
          events: true,
          error_groups: true,
          sessions: true,
        },
      },
    },
    orderBy: { created_at: "asc" },
  });

  console.log("\n=== PROJECTS ===");
  for (const p of projects) {
    const activeKeys = await prisma.apiKey.count({
      where: { project_id: p.id, deleted_at: null, revoked_at: null },
    });
    console.log({
      id: p.id,
      name: p.name,
      slug: p.slug,
      org: p.organization.name,
      orgId: p.organization_id,
      isLegacyDefault: p.id === LEGACY_PROJECT,
      apiKeysTotal: p._count.api_keys,
      apiKeysActive: activeKeys,
      events: p._count.events,
      errorGroups: p._count.error_groups,
      sessions: p._count.sessions,
      createdAt: p.created_at.toISOString(),
    });
  }

  console.log("\n=== MEMBERSHIPS ===");
  const memberships = await prisma.organizationMembership.findMany({
    include: {
      user: { select: { email: true } },
      organization: { select: { name: true } },
    },
    orderBy: { created_at: "asc" },
  });
  for (const m of memberships) {
    console.log({
      user: m.user.email,
      org: m.organization.name,
      orgId: m.organization_id,
      role: m.role,
    });
  }

  console.log("\n=== API KEYS (all) ===");
  const keys = await prisma.apiKey.findMany({
    select: {
      id: true,
      name: true,
      project_id: true,
      public_id: true,
      revoked_at: true,
      deleted_at: true,
      last_used_at: true,
      created_at: true,
      project: { select: { name: true } },
    },
    orderBy: { created_at: "asc" },
  });
  if (keys.length === 0) {
    console.log("(none)");
  } else {
    for (const k of keys) {
      console.log({
        project: k.project.name,
        projectId: k.project_id,
        name: k.name,
        publicId: k.public_id,
        revoked: k.revoked_at !== null,
        deleted: k.deleted_at !== null,
        lastUsed: k.last_used_at?.toISOString() ?? null,
      });
    }
  }

  console.log("\n=== TELEMETRY BY PROJECT (24h window) ===");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const p of projects) {
    const [events, errors, sessions] = await Promise.all([
      prisma.event.count({ where: { project_id: p.id, created_at: { gte: since } } }),
      prisma.errorGroup.count({
        where: { project_id: p.id, last_seen: { gte: since } },
      }),
      prisma.session.count({
        where: { project_id: p.id, started_at: { gte: since } },
      }),
    ]);
    const apps = await prisma.$queryRaw<{ app: string; n: bigint }[]>`
      SELECT app, COUNT(*)::bigint AS n FROM "Event"
      WHERE project_id = ${p.id} AND created_at >= ${since}
      GROUP BY app ORDER BY n DESC LIMIT 5
    `;
    console.log({
      project: p.name,
      projectId: p.id,
      events24h: events,
      errorGroups24h: errors,
      sessions24h: sessions,
      topApps24h: apps.map((a) => ({ app: a.app, count: Number(a.n) })),
    });
  }

  console.log("\n=== LEGACY DEFAULT CHECK ===");
  const legacyOrgMember = await prisma.organizationMembership.findFirst({
    where: { organization_id: LEGACY_ORG },
    include: { user: { select: { email: true } } },
  });
  const legacyProjectExists = await prisma.project.findUnique({
    where: { id: LEGACY_PROJECT },
    select: { id: true, organization_id: true, name: true },
  });
  console.log({
    legacyOrgHasMembers: legacyOrgMember
      ? { email: legacyOrgMember.user.email, role: legacyOrgMember.role }
      : null,
    legacyProject: legacyProjectExists,
    cookiePointsAtLegacy:
      "Dashboard cookies likely use a0000000-...001 (org) and ...002 (project) from migration defaults",
  });

  console.log("\n=== DIAGNOSIS ===");
  const onlyUser = users.length === 1 ? users[0]! : null;
  const userMemberships = onlyUser
    ? memberships.filter((m) => m.user_id === onlyUser.id)
    : [];
  const issues: string[] = [];

  if (keys.filter((k) => !k.deleted_at && !k.revoked_at).length === 0) {
    issues.push(
      "No active API keys — ingest is blocked, but dashboard READS still work off existing telemetry rows."
    );
  }
  if (userMemberships.length === 0) {
    issues.push("User has no org memberships — dashboard auth/bootstrap would fail.");
  }
  if (userMemberships.some((m) => m.organization_id === LEGACY_ORG)) {
    issues.push(
      "User is on legacy default org (migration seed) — not wrong, but org/project names may look generic."
    );
  }
  const projectsWithData = projects.filter(
    (p) => p._count.events > 0 || p._count.error_groups > 0
  );
  if (projectsWithData.length > 0 && projectsWithData.every((p) => p.id === LEGACY_PROJECT)) {
    issues.push(
      "All telemetry lives on legacy default project — overview queries scan that project (can be slow if row count is high)."
    );
  }
  for (const p of projects) {
    const active = await prisma.apiKey.count({
      where: { project_id: p.id, deleted_at: null, revoked_at: null },
    });
    if (p._count.events > 10_000 && active === 0) {
      issues.push(
        `Project "${p.name}" has ${p._count.events} events but no active API keys (historical data only).`
      );
    }
  }

  if (issues.length === 0) {
    console.log("No structural issues detected for dashboard loading.");
  } else {
    for (const i of issues) console.log("-", i);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
