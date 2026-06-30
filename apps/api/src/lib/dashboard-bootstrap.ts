import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { SessionUser } from "./auth-session.js";
import { tryResolveReadProjectId } from "./read-project-request.js";
import { loadNavScopeForProject, loadWorkspaceMetaForUser } from "./workspace-meta.js";

const bootstrapDebug =
  process.env.DASHBOARD_DEBUG === "1" ||
  (process.env.NODE_ENV !== "production" && process.env.DASHBOARD_DEBUG !== "0");

function logBootstrap(message: string, detail?: Record<string, unknown>): void {
  if (!bootstrapDebug) return;
  const suffix = detail ? ` ${JSON.stringify(detail)}` : "";
  console.log(`[api:dashboard-bootstrap] ${message}${suffix}`);
}

export type DashboardBootstrapUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type DashboardBootstrapPayload = {
  organizations: { id: string; name: string }[];
  projects: {
    id: string;
    name: string;
    slug: string;
    organizationId: string;
  }[];
  navScope: { apps: string[]; environments: string[] };
  user: DashboardBootstrapUser;
};

export async function buildDashboardBootstrap(
  prisma: PrismaClient,
  session: SessionUser,
  request: FastifyRequest,
  headerOrg?: string | null
): Promise<
  | { ok: true; payload: DashboardBootstrapPayload }
  | { ok: false; reason: "forbidden_org" | "no_user" }
> {
  const started = Date.now();
  const projectId = await tryResolveReadProjectId(request);
  logBootstrap("start", {
    userId: session.userId,
    projectId,
    headerOrg: headerOrg ?? null,
  });

  const navScopePromise =
    projectId !== null
      ? loadNavScopeForProject(prisma, projectId)
      : Promise.resolve({ apps: [] as string[], environments: [] as string[] });

  const [workspace, userRow, navScope] = await Promise.all([
    loadWorkspaceMetaForUser(prisma, session.userId, headerOrg),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, display_name: true },
    }),
    navScopePromise,
  ]);

  if (workspace.forbiddenOrg) {
    logBootstrap("forbidden_org", { ms: Date.now() - started });
    return { ok: false, reason: "forbidden_org" };
  }
  if (!userRow) {
    logBootstrap("no_user", { ms: Date.now() - started });
    return { ok: false, reason: "no_user" };
  }

  logBootstrap("ok", {
    ms: Date.now() - started,
    orgCount: workspace.organizations.length,
    projectCount: workspace.projects.length,
    appCount: navScope.apps.length,
    envCount: navScope.environments.length,
  });

  return {
    ok: true,
    payload: {
      organizations: workspace.organizations,
      projects: workspace.projects,
      navScope,
      user: {
        id: userRow.id,
        email: userRow.email,
        displayName: userRow.display_name,
      },
    },
  };
}
