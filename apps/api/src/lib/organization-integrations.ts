import type { PrismaClient } from "@prisma/client";

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
};

function activeApiKeyWhere(projectId: string, now: Date) {
  return {
    project_id: projectId,
    deleted_at: null,
    revoked_at: null,
    OR: [{ expires_at: null }, { expires_at: { gt: now } }],
  };
}

export async function loadOrganizationIntegrationSignals(
  db: PrismaClient,
  organizationId: string,
  projectId?: string | null
): Promise<OrganizationIntegrationSignals> {
  const now = new Date();

  if (projectId) {
    const project = await db.project.findFirst({
      where: { id: projectId, organization_id: organizationId, deleted_at: null },
      select: { id: true },
    });
    if (!project) {
      return { activeApiKeyCount: 0, projectCount: 0 };
    }

    const activeApiKeyCount = await db.apiKey.count({
      where: activeApiKeyWhere(project.id, now),
    });

    return { activeApiKeyCount, projectCount: 1 };
  }

  return { activeApiKeyCount: 0, projectCount: 0 };
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
      // QUOTA_EXCEEDED emails fire at monthly cap even when quota.enabled is false.
      return signals.projectCount > 0 ? "connected" : "disconnected";
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
  organizationId: string,
  projectId?: string | null
): Promise<{ organizationId: string; integrations: OrganizationIntegration[] }> {
  const signals = await loadOrganizationIntegrationSignals(
    db,
    organizationId,
    projectId
  );
  return {
    organizationId,
    integrations: resolveOrganizationIntegrations(signals),
  };
}
