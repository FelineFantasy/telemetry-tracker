import { describe, expect, it } from "vitest";
import {
  loadOrganizationIntegrationSignals,
  resolveOrganizationIntegrations,
} from "./organization-integrations.js";

const emptyChannelCounts = {
  enabledWebhookCount: 0,
  enabledSlackWebhookCount: 0,
  enabledDiscordWebhookCount: 0,
  enabledTeamsWebhookCount: 0,
  enabledTelegramWebhookCount: 0,
};

describe("organization-integrations", () => {
  it("marks SDK connected when the scoped project has active API keys", async () => {
    let capturedWhere: unknown;
    const prisma = {
      project: {
        findFirst: async () => ({ id: "proj-1" }),
      },
      apiKey: {
        count: async (args: { where: unknown }) => {
          capturedWhere = args.where;
          return 2;
        },
      },
      projectWebhook: {
        count: async () => 0,
      },
    };

    const signals = await loadOrganizationIntegrationSignals(
      prisma as never,
      "org-1",
      "proj-1"
    );
    const integrations = resolveOrganizationIntegrations(signals, "proj-1");

    expect(signals).toEqual({
      activeApiKeyCount: 2,
      projectCount: 1,
      ...emptyChannelCounts,
    });
    expect(capturedWhere).toMatchObject({
      project_id: "proj-1",
      deleted_at: null,
    });
    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("connected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("connected");
    expect(integrations.find((i) => i.id === "slack")).toMatchObject({
      availability: "available",
      status: "disconnected",
      trackedIssue: 223,
    });
    expect(integrations.find((i) => i.id === "webhooks")?.status).toBe("disconnected");
  });

  it("marks SDK and email alerts disconnected without a scoped project", async () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 0,
      ...emptyChannelCounts,
    });

    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("disconnected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("disconnected");
  });

  it("marks email alerts connected when the scoped project exists even if optional toggles are off", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 1,
      ...emptyChannelCounts,
    });

    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("disconnected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("connected");
  });

  it("marks webhooks connected when enabled generic destinations exist", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 1,
      ...emptyChannelCounts,
      enabledWebhookCount: 2,
    });

    expect(integrations.find((i) => i.id === "webhooks")).toMatchObject({
      availability: "available",
      status: "connected",
      trackedIssue: 225,
    });
  });

  it("marks Slack connected when enabled Slack destinations exist", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 1,
      ...emptyChannelCounts,
      enabledSlackWebhookCount: 1,
    });

    expect(integrations.find((i) => i.id === "slack")).toMatchObject({
      availability: "available",
      status: "connected",
    });
    expect(integrations.find((i) => i.id === "webhooks")?.status).toBe("disconnected");
  });

  it("marks Discord connected when enabled Discord destinations exist", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 1,
      ...emptyChannelCounts,
      enabledDiscordWebhookCount: 1,
    });

    expect(integrations.find((i) => i.id === "discord")).toMatchObject({
      availability: "available",
      status: "connected",
    });
  });

  it("returns disconnected signals when the scoped project is not in the org", async () => {
    const prisma = {
      project: {
        findFirst: async () => null,
      },
      apiKey: {
        count: async () => {
          throw new Error("should not count keys without a project");
        },
      },
      projectWebhook: {
        count: async () => {
          throw new Error("should not count webhooks without a project");
        },
      },
    };

    const signals = await loadOrganizationIntegrationSignals(
      prisma as never,
      "org-1",
      "proj-other"
    );

    expect(signals).toEqual({
      activeApiKeyCount: 0,
      projectCount: 0,
      ...emptyChannelCounts,
    });
  });

  it("excludes expired API keys from active counts", async () => {
    let capturedWhere: unknown;
    const prisma = {
      project: {
        findFirst: async () => ({ id: "proj-1" }),
      },
      apiKey: {
        count: async (args: { where: unknown }) => {
          capturedWhere = args.where;
          return 0;
        },
      },
      projectWebhook: {
        count: async () => 0,
      },
    };

    await loadOrganizationIntegrationSignals(prisma as never, "org-1", "proj-1");
    expect(capturedWhere).toMatchObject({
      OR: [{ expires_at: null }, { expires_at: { gt: expect.any(Date) } }],
    });
  });

  it("scopes project integration hrefs when a project id is provided", () => {
    const integrations = resolveOrganizationIntegrations(
      { activeApiKeyCount: 0, projectCount: 1, ...emptyChannelCounts },
      "proj-1"
    );

    expect(integrations.find((i) => i.id === "sdk")).toMatchObject({
      connectHref: "/dashboard/settings/keys?projectId=proj-1",
      configureHref: "/dashboard/settings/keys?projectId=proj-1",
    });
    expect(integrations.find((i) => i.id === "email_alerts")).toMatchObject({
      connectHref: "/dashboard/alerts?projectId=proj-1",
      configureHref: "/dashboard/alerts?projectId=proj-1",
    });
    expect(integrations.find((i) => i.id === "slack")).toMatchObject({
      connectHref: "/dashboard/alerts?projectId=proj-1",
      configureHref: "/dashboard/alerts?projectId=proj-1",
    });
  });

  it("exposes configure links for available and planned channel integrations", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 0,
      ...emptyChannelCounts,
    });

    expect(integrations.find((i) => i.id === "webhooks")).toMatchObject({
      availability: "available",
      trackedIssue: 225,
    });
    expect(integrations.find((i) => i.id === "slack")).toMatchObject({
      availability: "available",
      trackedIssue: 223,
      connectHref: "/dashboard/alerts",
    });
    expect(integrations.find((i) => i.id === "discord")).toMatchObject({
      availability: "available",
      trackedIssue: 224,
    });
    expect(integrations.find((i) => i.id === "microsoft_teams")).toMatchObject({
      availability: "available",
      trackedIssue: 500,
    });
    expect(integrations.find((i) => i.id === "telegram")).toMatchObject({
      availability: "available",
      trackedIssue: 500,
    });
  });

  it("marks Teams and Telegram connected when enabled destinations exist", () => {
    expect(
      resolveOrganizationIntegrations({
        activeApiKeyCount: 0,
        projectCount: 1,
        ...emptyChannelCounts,
        enabledTeamsWebhookCount: 1,
      }).find((i) => i.id === "microsoft_teams")?.status
    ).toBe("connected");
    expect(
      resolveOrganizationIntegrations({
        activeApiKeyCount: 0,
        projectCount: 1,
        ...emptyChannelCounts,
        enabledTelegramWebhookCount: 1,
      }).find((i) => i.id === "telegram")?.status
    ).toBe("connected");
  });
});
