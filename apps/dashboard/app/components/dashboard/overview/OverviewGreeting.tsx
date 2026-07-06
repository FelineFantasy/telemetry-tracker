import type { ReactNode } from "react";
import type { DashboardUser } from "@/lib/dashboard-user";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "there";
  const first = local.split(/[._-]/)[0] ?? local;
  return capitalizeFirst(first);
}

function greetingName(user: DashboardUser | null): string {
  if (!user) return "there";

  const rawDisplayName = user.displayName?.trim();
  if (rawDisplayName && !rawDisplayName.includes("@")) {
    return rawDisplayName.split(/\s+/)[0] ?? rawDisplayName;
  }

  if (user.email?.trim()) {
    return nameFromEmail(user.email);
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
  const name = greetingName(user);
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl lg:text-3xl">
          <span className="block sm:inline">{timeGreeting()},</span>{" "}
          <span className="block sm:inline">{name}</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your workspace today.
        </p>
      </div>
      {actions ? <div className="relative z-20 shrink-0">{actions}</div> : null}
    </header>
  );
}
