"use client";

import { usePathname } from "next/navigation";
import { DashboardAppContext } from "@/app/components/dashboard/DashboardAppContext";

export function ConditionalAppContext({ apps }: { apps: string[] }) {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/dashboard/overview")) return null;
  return <DashboardAppContext apps={apps} />;
}
