import type { ReactNode } from "react";
import type { DashboardUser } from "@/lib/dashboard-user";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function displayName(user: DashboardUser | null): string {
  if (user?.displayName?.trim()) {
    return user.displayName.trim().split(/\s+/)[0] ?? user.displayName;
  }
  if (user?.email) {
    return user.email.split("@")[0] ?? "there";
  }
  return "there";
}

export function OverviewGreeting({
  user,
  actions,
}: {
  user: DashboardUser | null;
  actions?: ReactNode;
}) {
  const name = displayName(user);
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {timeGreeting()}, {name}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your workspace today.
        </p>
      </div>
      {actions ? <div className="relative z-20 shrink-0">{actions}</div> : null}
    </header>
  );
}
