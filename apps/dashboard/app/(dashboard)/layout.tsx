import { AppSidebar } from "../components/AppSidebar";
import { TopNav } from "../components/TopNav";

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

  return (
    <div className="dashboard-layout">
      <AppSidebar apps={apps} />
      <div className="dashboard-right">
        <TopNav />
        <main className="main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
