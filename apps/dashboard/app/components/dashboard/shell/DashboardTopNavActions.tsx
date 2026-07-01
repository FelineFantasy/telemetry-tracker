"use client";

import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { DashboardCommandPalette } from "./DashboardCommandPalette";
import { DashboardNotificationsLoader } from "./DashboardNotificationsLoader";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardUserMenu } from "./DashboardUserMenu";
import type { DashboardUser } from "@/lib/dashboard-user";

function NotificationsFallback() {
  return (
    <div
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground"
      aria-hidden
    >
      <span className="h-4 w-4 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function DashboardTopNavActions({ user }: { user: DashboardUser | null }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <DashboardCommandPalette />
      <DashboardQuickActions />
      <Suspense fallback={<NotificationsFallback />}>
        <DashboardNotificationsLoader />
      </Suspense>
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
