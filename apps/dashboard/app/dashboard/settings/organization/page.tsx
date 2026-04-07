import { PageTitle } from "@/app/components/PageTitle";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import { getDashboardOrganizationId } from "@/lib/dashboard-org";
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
  const [capabilities, organizations, currentOrgId] = await Promise.all([
    getDashboardSessionContext(),
    loadOrgs(),
    getDashboardOrganizationId(),
  ]);

  const orgIdSet = new Set(organizations.map((o) => o.id));
  const effectiveOrgId =
    currentOrgId && orgIdSet.has(currentOrgId)
      ? currentOrgId
      : organizations[0]?.id ?? null;

  if (!capabilities) {
    return (
      <>
        <PageTitle title="Organization" context="Sign in to manage organizations and projects." />
        <ErrorState message="You must be signed in to view this page." />
      </>
    );
  }

  const canManage = capabilities.canManageOrganization;

  return (
    <>
      <PageTitle
        title="Organization"
        context="Create organizations and projects. Only organization owners can add projects."
      />

      {!canManage ? (
        <p className="text-muted-foreground">
          Only an organization owner can create organizations and projects.
        </p>
      ) : (
        <div className="flex flex-col gap-10 max-w-md">
          <section className="card p-6" aria-labelledby="create-org-heading">
            <h2 id="create-org-heading" className="card__label mb-4">
              New organization
            </h2>
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
            {effectiveOrgId ? (
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
                  Created in the active organization ({organizations.find((o) => o.id === effectiveOrgId)?.name ?? "selected"}). Switch organization in the sidebar if needed.
                </p>
                <Button type="submit" variant="primary">
                  Create project
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground m-0">
                Create an organization first, then add a project.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
