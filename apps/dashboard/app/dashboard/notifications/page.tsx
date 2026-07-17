import { Suspense } from "react";
import { NotificationsCenterClient } from "./NotificationsCenterClient";
import { fetchDashboardNotificationsPayload } from "@/lib/dashboard-notifications";
import { getDashboardWorkspaceForRequest } from "@/lib/dashboard-workspace-request";

export const dynamic = "force-dynamic";

type SearchParams = {
  type?: string;
  projectId?: string;
  unread?: string;
};

function parseType(raw: string | undefined): string {
  const allowed = new Set(["issue", "billing", "quota", "team", "alert"]);
  if (!raw) return "";
  return allowed.has(raw) ? raw : "";
}

function parseProjectId(raw: string | undefined): string {
  if (!raw) return "";
  return /^[0-9a-f-]{36}$/i.test(raw.trim()) ? raw.trim().toLowerCase() : "";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const type = parseType(params.type);
  const projectId = parseProjectId(params.projectId);
  const unreadOnly = params.unread === "1" || params.unread === "true";

  const { effectiveProjectId, resolvedOrgId } = await getDashboardWorkspaceForRequest();
  const payload = await fetchDashboardNotificationsPayload({
    scope: "organization",
    type: type || null,
    projectId: projectId || null,
    unreadOnly,
    projectIdOverride: effectiveProjectId === "" ? undefined : effectiveProjectId,
    organizationIdOverride: resolvedOrgId ?? undefined,
  });

  return (
    <Suspense fallback={null}>
      <NotificationsCenterClient
        initialItems={payload.items}
        projects={payload.projects}
        initialType={type}
        initialProjectId={projectId}
        initialUnreadOnly={unreadOnly}
        currentProjectId={effectiveProjectId}
        currentOrganizationId={resolvedOrgId}
      />
    </Suspense>
  );
}
