"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const NEW_PROJECT_PARAM = "newProject";

/** Organization settings route (no query). */
export const ORGANIZATION_SETTINGS_PATH = "/dashboard/settings/organization";

/** Sidebar / deep-link target for “create project” from empty-org rail. */
export const ORGANIZATION_SETTINGS_NEW_PROJECT_URL =
  `${ORGANIZATION_SETTINGS_PATH}?${NEW_PROJECT_PARAM}=1`;

/**
 * When the user lands on Organization settings with `?newProject=1` (e.g. from the empty-project
 * sidebar CTA), scroll to the new-project section, focus the name field, then drop the param.
 * Query params survive App Router client navigation more reliably than `#hash`.
 */
export function OrganizationSettingsNewProjectParam() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get(NEW_PROJECT_PARAM) !== "1") return;

    requestAnimationFrame(() => {
      document.getElementById("create-project-heading")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      queueMicrotask(() => {
        document.getElementById("proj-name")?.focus();
        router.replace(pathname ?? "/", { scroll: false });
      });
    });
  }, [searchParams, pathname, router]);

  return null;
}
