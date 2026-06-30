import { getDashboardOrganizationId } from "@/lib/dashboard-org";
import {
  getDashboardProjectCookie,
  PROJECT_UUID_RE,
} from "@/lib/dashboard-project";

export type OverviewRequestScope = {
  projectId: string;
  organizationId: string | null;
};

/** Cookie-only scope for firing overview in parallel with bootstrap. */
export async function readOverviewCookieScope(): Promise<OverviewRequestScope> {
  const [projectCookie, orgCookie] = await Promise.all([
    getDashboardProjectCookie(),
    getDashboardOrganizationId(),
  ]);
  return {
    projectId:
      projectCookie && PROJECT_UUID_RE.test(projectCookie) ? projectCookie : "",
    organizationId:
      orgCookie && PROJECT_UUID_RE.test(orgCookie) ? orgCookie.toLowerCase() : null,
  };
}

export function overviewScopeMatches(
  cookieScope: OverviewRequestScope,
  resolved: OverviewRequestScope
): boolean {
  return (
    cookieScope.projectId.toLowerCase() === resolved.projectId.toLowerCase() &&
    (cookieScope.organizationId ?? "").toLowerCase() ===
      (resolved.organizationId ?? "").toLowerCase()
  );
}
