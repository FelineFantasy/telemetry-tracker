import { DashboardShell } from "@/app/components/dashboard/DashboardShell";

const API_BASE = process.env.API_URL || "http://localhost:3001";

async function getApps(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/apps`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.apps) ? data.apps : [];
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apps = await getApps();

  return <DashboardShell apps={apps}>{children}</DashboardShell>;
}
