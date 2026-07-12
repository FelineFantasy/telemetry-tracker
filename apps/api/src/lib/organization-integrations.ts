import type { PrismaClient } from "@prisma/client";
import { parseProjectAlertSettings } from "./project-alert-settings.js";

export const INTEGRATION_IDS = [
  "sdk",
  "email_alerts",
  "webhooks",
  "slack",
  "discord",
  "github",
] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];

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
  /** Dashboard path for Connect when disconnected. */
  connectHref: string;
  /** Dashboard path for Configure when connected. */
  configureHref: string;
  /** GitHub issue tracking full integration delivery, when planned. */
  trackedIssue?: number;
};

type IntegrationCatalogEntry = Omit<
  OrganizationIntegration,
  "status" | "connectHref" | "configureHref"
> & {
  connectHref: string;
  configureHref: string;
};

const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    id: "sdk",
    name: "Telemetry SDK",
    description: "Send events and errors from your apps with project API keys.",
    scope: "project",
    availability: "available",
    connectHref: "/dashboard/settings/keys",
    configureHref: "/dashboard/settings/keys",
  },
  {
    id: "email_alerts",
    name: "Email alerts",
    description: "Error spike and quota notifications delivered to your inbox.",
    scope: "project",
    availability: "available",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "HTTP callbacks when errors spike or quotas are near limit.",
    scope: "project",
    availability: "planned",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post alerts and error summaries to a channel.",
    scope: "organization",
    availability: "planned",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
    trackedIssue: 223,
  },
  {
    id: "discord",
    name: "Discord",
    description: "Deliver alert notifications to a Discord channel.",
    scope: "organization",
    availability: "planned",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
    trackedIssue: 224,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Link commits and releases to deployments and errors.",
    scope: "organization",
    availability: "planned",
    connectHref: "/docs",
    configureHref: "/docs",
  },
];

export type OrganizationIntegrationSignals = {
  activeApiKeyCount: number;
  projectCount: number;
  alertsEnabledProjectCount: number;
};

export async function loadOrganizationIntegrationSignals(
  db: PrismaClient,
  organizationId: string
): Promise<OrganizationIntegrationSignals> {
  const projects = await db.project.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    select: { id: true, alert_settings: true },
  });

  const projectIds = projects.map((p) => p.id);
  const activeApiKeyCount =
    projectIds.length === 0
      ? 0
      : await db.apiKey.count({
          where: {
            project_id: { in: projectIds },
            deleted_at: null,
            revoked_at: null,
          },
        });

  let alertsEnabledProjectCount = 0;
  for (const project of projects) {
    const settings = parseProjectAlertSettings(project.alert_settings);
    if (settings.errorSpike.enabled || settings.quota.enabled) {
      alertsEnabledProjectCount += 1;
    }
  }

  return {
    activeApiKeyCount,
    projectCount: projects.length,
    alertsEnabledProjectCount,
  };
}

export function resolveOrganizationIntegrations(
  signals: OrganizationIntegrationSignals
): OrganizationIntegration[] {
  return INTEGRATION_CATALOG.map((entry) => ({
    ...entry,
    status: resolveIntegrationStatus(entry.id, signals),
  }));
}

function resolveIntegrationStatus(
  id: IntegrationId,
  signals: OrganizationIntegrationSignals
): IntegrationStatus {
  switch (id) {
    case "sdk":
      return signals.activeApiKeyCount > 0 ? "connected" : "disconnected";
    case "email_alerts":
      return signals.alertsEnabledProjectCount > 0 ? "connected" : "disconnected";
    case "webhooks":
    case "slack":
    case "discord":
    case "github":
      return "disconnected";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export async function listOrganizationIntegrations(
  db: PrismaClient,
  organizationId: string
): Promise<{ organizationId: string; integrations: OrganizationIntegration[] }> {
  const signals = await loadOrganizationIntegrationSignals(db, organizationId);
  return {
    organizationId,
    integrations: resolveOrganizationIntegrations(signals),
  };
}
