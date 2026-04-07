import { PageTitle } from "@/app/components/PageTitle";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import { getDashboardOrganizationId } from "@/lib/dashboard-org";
import { getDashboardUser } from "@/lib/dashboard-user";
import {
  createOrganizationAction,
  createProjectAction,
} from "@/app/dashboard/actions";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";

type OrgRow = { id: string; name: string };

async function loadOrgs(): Promise<OrgRow[]> {
  const res = await dashboardApiFetch("/api/meta/organizations");
  if (!res.ok) return [];
  const data = (await res.json()) as { organizations?: OrgRow[] };
  return Array.isArray(data.organizations) ? data.organizations : [];
}

export default async function OrganizationSettingsPage() {
  const [user, capabilities, organizations, currentOrgId] = await Promise.all([
    getDashboardUser(),
    getDashboardSessionContext(),
    loadOrgs(),
    getDashboardOrganizationId(),
  ]);

  const orgIdSet = new Set(organizations.map((o) => o.id));
  const effectiveOrgId =
    currentOrgId && orgIdSet.has(currentOrgId)
      ? currentOrgId
      : organizations[0]?.id ?? null;

  if (!user) {
    return (
      <>
        <PageTitle title="Organization" context="Sign in to manage organizations and projects." />
        <ErrorState message="You must be signed in to view this page." />
      </>
    );
  }

  /** OWNER in the active organization (sidebar) — matches POST /meta/projects. */
  const canCreateProject = capabilities?.canCreateProject === true;
  const permissionsUnknown = capabilities === null;

  return (
    <>
      <PageTitle
        title="Organization"
        context="Anyone signed in can create a new organization. Only owners can create projects in an existing organization."
      />

      {permissionsUnknown ? (
        <p className="text-muted-foreground mb-6 max-w-lg" role="status">
          Project permissions could not be loaded (invalid project or session). Choose a project you
          have access to in the sidebar, or sign in again. You can still create a new organization
          below.
        </p>
      ) : null}

      <div className="flex flex-col gap-10 max-w-md">
        <section className="card p-6" aria-labelledby="create-org-heading">
          <h2 id="create-org-heading" className="card__label mb-4">
            New organization
          </h2>
          <p className="text-xs text-muted-foreground m-0 mb-3">
            You become the owner of the new organization. This does not require owner role elsewhere.
          </p>
          <form action={createOrganizationAction} className="flex flex-col gap-3">
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
          </form>
        </section>

        <section className="card p-6" aria-labelledby="create-project-heading">
          <h2 id="create-project-heading" className="card__label mb-4">
            New project
          </h2>
          {canCreateProject && effectiveOrgId ? (
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
              <p className="text-xs text-muted-foreground m-0">
                Created in the active organization (
                {organizations.find((o) => o.id === effectiveOrgId)?.name ?? "selected"}). Switch
                organization in the sidebar if needed.
              </p>
              <Button type="submit" variant="primary">
                Create project
              </Button>
            </form>
          ) : permissionsUnknown ? (
            <p className="text-muted-foreground m-0">
              Fix the project selection above to create a project in this organization.
            </p>
          ) : !effectiveOrgId ? (
            <p className="text-muted-foreground m-0">
              Create or join an organization first, then add a project.
            </p>
          ) : (
            <p className="text-muted-foreground m-0">
              Only an organization owner can create projects. Ask an owner to grant access or
              transfer ownership.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
