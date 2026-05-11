import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardSessionId } from "@/lib/dashboard-project";

export type DashboardUser = {
  id: string;
  email: string;
  displayName: string | null;
};

/** Current user from API `/auth/me`, or `null` if not signed in / session invalid. */
export async function getDashboardUser(): Promise<DashboardUser | null> {
  const session = await getDashboardSessionId();
  if (!session) return null;
  const res = await dashboardApiFetch("/api/auth/me", undefined, {
    omitOrganizationHeader: true,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    user: { id: string; email: string; displayName: string | null };
  };
  return data.user ?? null;
}
