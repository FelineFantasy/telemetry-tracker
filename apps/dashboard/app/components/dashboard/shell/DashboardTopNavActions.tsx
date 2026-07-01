"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { DashboardCommandPalette } from "./DashboardCommandPalette";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardUserMenu } from "./DashboardUserMenu";
import type { DashboardUser } from "@/lib/dashboard-user";

export function DashboardTopNavActions({
  user,
  notificationsSlot,
}: {
  user: DashboardUser | null;
  notificationsSlot: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <DashboardCommandPalette />
      <DashboardQuickActions />
      {notificationsSlot}
      <Link
        href="/docs"
        aria-label="Documentation"
        className="hidden h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-surface/60 hover:text-foreground sm:grid"
      >
        <BookOpen className="h-4 w-4" />
      </Link>
      <DashboardUserMenu user={user} />
    </div>
  );
}
