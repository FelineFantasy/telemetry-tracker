import { dashboardApiFetch } from "@/lib/dashboard-api";

export type IntegrationId =
  | "sdk"
  | "email_alerts"
  | "webhooks"
  | "slack"
  | "discord"
  | "github";

export type IntegrationScope = "organization" | "project";

export type IntegrationAvailability = "available" | "planned";

export type IntegrationStatus = "connected" | "disconnected";

export type OrganizationIntegration = {
  id: IntegrationId;
  name: string;
  description: string;
  scope: IntegrationScope;
  availability: IntegrationAvailability;
  status: IntegrationStatus;
  connectHref: string;
  configureHref: string;
  trackedIssue?: number;
};

export type FetchOrganizationIntegrationsResult =
  | {
      ok: true;
      organizationId: string;
      integrations: OrganizationIntegration[];
    }
  | { ok: false; error: string };

export async function fetchOrganizationIntegrations(
  organizationId: string
): Promise<FetchOrganizationIntegrationsResult> {
  const path = `/api/meta/organizations/${encodeURIComponent(organizationId)}/integrations`;

  const res = await dashboardApiFetch(path, undefined, {
    organizationIdOverride: organizationId,
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { error?: string };
      if (typeof data.error === "string" && data.error.trim()) {
        return { ok: false, error: data.error };
      }
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: `Could not load integrations (${res.status}): ${text.slice(0, 200)}`,
    };
  }

  try {
    const data = (await res.json()) as {
      organizationId?: string;
      integrations?: OrganizationIntegration[];
    };
    return {
      ok: true,
      organizationId: data.organizationId ?? organizationId,
      integrations: Array.isArray(data.integrations) ? data.integrations : [],
    };
  } catch {
    return { ok: false, error: "Invalid response from server" };
  }
}
