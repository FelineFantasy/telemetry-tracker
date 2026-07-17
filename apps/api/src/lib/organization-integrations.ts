import type { AlertWebhookProvider, PrismaClient } from "@prisma/client";

export const INTEGRATION_IDS = [
  "sdk",
  "email_alerts",
  "webhooks",
  "slack",
  "discord",
  "microsoft_teams",
  "telegram",
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
    description: "HTTPS callbacks when error spikes or quota alerts fire.",
    scope: "project",
    availability: "available",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
    trackedIssue: 225,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post alerts to a Slack channel via Incoming Webhook.",
    scope: "project",
    availability: "available",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
    trackedIssue: 223,
  },
  {
    id: "discord",
    name: "Discord",
    description: "Deliver alert notifications to a Discord channel via webhook.",
    scope: "project",
    availability: "available",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
    trackedIssue: 224,
  },
  {
    id: "microsoft_teams",
    name: "Microsoft Teams",
    description: "Post alerts to a Teams channel via Incoming Webhook.",
    scope: "project",
    availability: "planned",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
    trackedIssue: 500,
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Send alerts to a Telegram chat via Bot API.",
    scope: "project",
    availability: "planned",
    connectHref: "/dashboard/alerts",
    configureHref: "/dashboard/alerts",
    trackedIssue: 500,
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
  /** Enabled GENERIC project webhooks (not chat channel destinations). */
  enabledWebhookCount: number;
  enabledSlackWebhookCount: number;
  enabledDiscordWebhookCount: number;
  enabledTeamsWebhookCount: number;
  enabledTelegramWebhookCount: number;
};

function activeApiKeyWhere(projectId: string, now: Date) {
  return {
    project_id: projectId,
    deleted_at: null,
    revoked_at: null,
    OR: [{ expires_at: null }, { expires_at: { gt: now } }],
  };
}

async function countEnabledProviderWebhooks(
  db: PrismaClient,
  projectId: string,
  provider: AlertWebhookProvider
): Promise<number> {
  return db.projectWebhook.count({
    where: {
      project_id: projectId,
      deleted_at: null,
      enabled: true,
      provider,
    },
  });
}

export async function loadOrganizationIntegrationSignals(
  db: PrismaClient,
  organizationId: string,
  projectId?: string | null
): Promise<OrganizationIntegrationSignals> {
  const empty: OrganizationIntegrationSignals = {
    activeApiKeyCount: 0,
    projectCount: 0,
    enabledWebhookCount: 0,
    enabledSlackWebhookCount: 0,
    enabledDiscordWebhookCount: 0,
    enabledTeamsWebhookCount: 0,
    enabledTelegramWebhookCount: 0,
  };
  const now = new Date();

  if (projectId) {
    const project = await db.project.findFirst({
      where: { id: projectId, organization_id: organizationId, deleted_at: null },
      select: { id: true },
    });
    if (!project) {
      return empty;
    }

    const [
      activeApiKeyCount,
      enabledWebhookCount,
      enabledSlackWebhookCount,
      enabledDiscordWebhookCount,
      enabledTeamsWebhookCount,
      enabledTelegramWebhookCount,
    ] = await Promise.all([
      db.apiKey.count({
        where: activeApiKeyWhere(project.id, now),
      }),
      countEnabledProviderWebhooks(db, project.id, "GENERIC"),
      countEnabledProviderWebhooks(db, project.id, "SLACK"),
      countEnabledProviderWebhooks(db, project.id, "DISCORD"),
      countEnabledProviderWebhooks(db, project.id, "MICROSOFT_TEAMS"),
      countEnabledProviderWebhooks(db, project.id, "TELEGRAM"),
    ]);

    return {
      activeApiKeyCount,
      projectCount: 1,
      enabledWebhookCount,
      enabledSlackWebhookCount,
      enabledDiscordWebhookCount,
      enabledTeamsWebhookCount,
      enabledTelegramWebhookCount,
    };
  }

  return empty;
}

function projectScopedHref(
  href: string,
  scope: IntegrationScope,
  projectId?: string | null
): string {
  if (scope !== "project") return href;
  const id = projectId?.trim().toLowerCase();
  if (!id) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}projectId=${encodeURIComponent(id)}`;
}

export function resolveOrganizationIntegrations(
  signals: OrganizationIntegrationSignals,
  projectId?: string | null
): OrganizationIntegration[] {
  return INTEGRATION_CATALOG.map((entry) => ({
    ...entry,
    connectHref: projectScopedHref(entry.connectHref, entry.scope, projectId),
    configureHref: projectScopedHref(entry.configureHref, entry.scope, projectId),
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
      return signals.enabledWebhookCount > 0 ? "connected" : "disconnected";
    case "slack":
      return signals.enabledSlackWebhookCount > 0 ? "connected" : "disconnected";
    case "discord":
      return signals.enabledDiscordWebhookCount > 0 ? "connected" : "disconnected";
    case "microsoft_teams":
      return signals.enabledTeamsWebhookCount > 0 ? "connected" : "disconnected";
    case "telegram":
      return signals.enabledTelegramWebhookCount > 0 ? "connected" : "disconnected";
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
    integrations: resolveOrganizationIntegrations(signals, projectId),
  };
}
