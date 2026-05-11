import { Suspense } from "react";
import Link from "next/link";
import { PageTitle } from "@/app/components/PageTitle";
import { OrganizationSettingsNewProjectParam } from "@/app/components/OrganizationSettingsNewProjectParam";
import { ScrollToHash } from "@/app/components/ScrollToHash";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import { getDashboardWorkspaceForRequest } from "@/lib/dashboard-workspace-request";
import { getDashboardUser } from "@/lib/dashboard-user";
import {
  createOrganizationAction,
  createProjectAction,
} from "@/app/dashboard/actions";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";

type MemberRow = { userId: string; role: string };

async function loadMembersForOrg(
  organizationId: string
): Promise<{ ok: true; members: MemberRow[] } | { ok: false }> {
  const res = await dashboardApiFetch(
    `/api/meta/members?organizationId=${encodeURIComponent(organizationId)}`,
    undefined,
    { organizationIdOverride: organizationId }
  );
  if (!res.ok) return { ok: false };
  const data = (await res.json()) as { members?: MemberRow[] };
  return { ok: true, members: data.members ?? [] };
}

export default async function OrganizationSettingsPage() {
  const [workspace, user] = await Promise.all([
    getDashboardWorkspaceForRequest(),
    getDashboardUser(),
  ]);

  const { organizations, resolvedOrgId, effectiveProjectId } = workspace;

  const capabilities = await getDashboardSessionContext(
    effectiveProjectId === "" ? null : effectiveProjectId,
    resolvedOrgId
  );

  const effectiveOrgId = resolvedOrgId;

  const membersRes =
    effectiveOrgId !== null ? await loadMembersForOrg(effectiveOrgId) : { ok: false as const };

  if (!user) {
    return (
      <>
        <PageTitle title="Organization" context="Sign in to manage organizations and projects." />
        <ErrorState message="You must be signed in to view this page." />
      </>
    );
  }

  const permissionsUnknown = capabilities === null;
  /** Prefer roster from GET /meta/members (same org as sidebar) — matches POST /meta/projects when session-context is missing or stale. */
  const canCreateProject =
    membersRes.ok && user
      ? membersRes.members.some((m) => m.userId === user.id && m.role === "OWNER")
      : capabilities?.canCreateProject === true;

  const activeOrgName =
    effectiveOrgId !== null
      ? (organizations.find((o) => o.id === effectiveOrgId)?.name ?? "Selected organization")
      : null;

  const createOrganizationFields = (
    <>
      <label className="text-sm text-muted-foreground" htmlFor="org-name">
        Name
      </label>
      <input
        id="org-name"
        name="name"
        type="text"
        required
        maxLength={120}
        className="filter-input"
        placeholder="Acme Inc."
        autoComplete="organization"
      />
      <Button type="submit" variant="primary">
        Create organization
      </Button>
    </>
  );

  return (
    <>
      <Suspense fallback={null}>
        <OrganizationSettingsNewProjectParam />
      </Suspense>
      <ScrollToHash />
      <PageTitle
        title="Organization"
        context="An organization is the top-level workspace: members (Team), billing, and one or more projects. Use the sidebar to switch organizations. Here you add projects to the selected organization (owners only) or create another organization when you need a separate workspace."
      />

      {permissionsUnknown ? (
        <p
          className="mb-6 max-w-xl rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          Usage and billing extras could not be loaded for this session (for example a stale
          project cookie). You can still add a project below if you own{" "}
          {activeOrgName ? (
            <>
              <strong>{activeOrgName}</strong>
            </>
          ) : (
            "this workspace"
          )}
          .
        </p>
      ) : null}

      {effectiveOrgId ? (
        <div className="mb-6 flex max-w-2xl flex-col gap-3 rounded-lg border border-border/70 bg-card/35 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="m-0 text-sm text-muted-foreground">
            Use this page to <strong className="text-foreground">add projects</strong> to the
            organization selected in the sidebar.{" "}
            <strong className="text-foreground">Team</strong> and <strong className="text-foreground">API keys</strong>{" "}
            live under separate settings — open them from here when you need people or ingestion
            keys.
          </p>
          <div className="flex flex-shrink-0 flex-wrap gap-2">
            <a
              href="#create-project-section"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-primary/45 bg-primary/20 px-3 text-sm font-semibold text-foreground hover:bg-primary/30"
            >
              Add a project
            </a>
            <Link
              href="/dashboard/settings/team"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Team
            </Link>
            <Link
              href="/dashboard/settings/keys"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              API keys
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-10 max-w-md">
        {effectiveOrgId ? (
          <section
            className="card scroll-mt-24 border border-primary/25 bg-primary/[0.04] p-6"
            aria-labelledby="create-project-heading"
            id="create-project-section"
          >
            <p className="m-0 mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Selected in sidebar
            </p>
            <p className="mb-4 text-base font-semibold text-foreground">{activeOrgName}</p>
            <h2 id="create-project-heading" className="card__label mb-2">
              Add a project
            </h2>
            <p className="m-0 mb-4 text-sm text-muted-foreground">
              New projects are created only in <strong className="text-foreground">{activeOrgName}</strong>.
              Fill in the fields, then press <strong className="text-foreground">Create project</strong>
              — that is the submit button for this form (not the section title above).
            </p>
            {canCreateProject ? (
              <form action={createProjectAction} className="flex flex-col gap-3">
                <input type="hidden" name="organizationId" value={effectiveOrgId} />
                <label className="text-sm text-muted-foreground" htmlFor="proj-name">
                  Project name
                </label>
                <input
                  id="proj-name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  className="filter-input"
                  placeholder="Mobile app"
                />
                <label className="text-sm text-muted-foreground" htmlFor="proj-slug">
                  Slug <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="proj-slug"
                  name="slug"
                  type="text"
                  maxLength={120}
                  className="filter-input"
                  placeholder="mobile-app"
                  autoComplete="off"
                />
                <Button type="submit" variant="primary">
                  Create project
                </Button>
              </form>
            ) : membersRes.ok ? (
              <p className="text-muted-foreground m-0 text-sm">
                Only an organization owner can create projects. Ask an owner for access or to
                transfer ownership.
              </p>
            ) : permissionsUnknown ? (
              <p className="text-muted-foreground m-0 text-sm">
                We could not verify your role for this organization. Try a refresh, sign out and
                back in, or switch organization in the sidebar and return here.
              </p>
            ) : (
              <p className="text-muted-foreground m-0 text-sm">
                Could not load members for this organization. Check your connection or try again
                later.
              </p>
            )}
          </section>
        ) : (
          <p className="text-muted-foreground m-0 text-sm" role="status">
            Create an organization first—then you can add projects to it.
          </p>
        )}

        {organizations.length > 0 ? (
          <details className="group rounded-lg border border-border/80 bg-card/40 open:border-primary/25">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-muted-foreground/50 underline-offset-2 group-open:no-underline">
                Create another organization
              </span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Optional — use this when you need a separate workspace (billing and members are per
                organization).
              </span>
            </summary>
            <div className="border-t border-border/60 px-4 py-4">
              <form action={createOrganizationAction} className="flex flex-col gap-3">
                {createOrganizationFields}
              </form>
            </div>
          </details>
        ) : (
          <section className="card p-6" aria-labelledby="create-org-heading">
            <h2 id="create-org-heading" className="card__label mb-4">
              Your first organization
            </h2>
            <p className="text-xs text-muted-foreground m-0 mb-3">
              You become the owner. After this, use Add a project to attach apps and API keys.
            </p>
            <form action={createOrganizationAction} className="flex flex-col gap-3">
              {createOrganizationFields}
            </form>
          </section>
        )}
      </div>
    </>
  );
}
