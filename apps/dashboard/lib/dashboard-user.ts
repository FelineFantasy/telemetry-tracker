import { cache } from "react";
import { fetchDashboardBootstrap } from "@/lib/dashboard-bootstrap-server";

export type DashboardUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/** Current user from dashboard bootstrap, or `null` if not signed in / session invalid. */
export const getDashboardUser = cache(async function getDashboardUser(): Promise<DashboardUser | null> {
  const bootstrap = await fetchDashboardBootstrap();
  return bootstrap?.user ?? null;
});
