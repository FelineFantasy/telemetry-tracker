import { dashboardApiFetch } from "@/lib/dashboard-api";

export type DashboardAuthSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  deviceBrowser: string | null;
  deviceOs: string | null;
  current: boolean;
};

export async function fetchAuthSessions(): Promise<DashboardAuthSession[]> {
  const res = await dashboardApiFetch("/api/auth/sessions", undefined, {
    omitOrganizationHeader: true,
    omitProjectHeader: true,
  });
  if (!res.ok) return [];
  try {
    const data = (await res.json()) as { sessions?: DashboardAuthSession[] };
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch {
    return [];
  }
}
