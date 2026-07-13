import { describe, expect, it } from "vitest";
import {
  loadOrganizationIntegrationSignals,
  resolveOrganizationIntegrations,
} from "./organization-integrations.js";

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
    });
    expect(capturedWhere).toMatchObject({
      project_id: "proj-1",
      deleted_at: null,
      revoked_at: null,
      OR: [{ expires_at: null }, { expires_at: { gt: expect.any(Date) } }],
    });
    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("connected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("connected");
    expect(integrations.find((i) => i.id === "slack")?.status).toBe("disconnected");
    expect(integrations.find((i) => i.id === "webhooks")?.status).toBe("disconnected");
  });

  it("marks SDK and email alerts disconnected without a scoped project", async () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 0,
    });

    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("disconnected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("disconnected");
  });

  it("marks email alerts connected when the scoped project exists even if optional toggles are off", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 1,
    });

    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("disconnected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("connected");
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
    };

    const signals = await loadOrganizationIntegrationSignals(
      prisma as never,
      "org-1",
      "proj-other"
    );

    expect(signals).toEqual({ activeApiKeyCount: 0, projectCount: 0 });
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
    };

    await loadOrganizationIntegrationSignals(prisma as never, "org-1", "proj-1");

    expect(capturedWhere).toMatchObject({
      OR: [{ expires_at: null }, { expires_at: { gt: expect.any(Date) } }],
    });
  });

  it("scopes project integration hrefs when a project id is provided", () => {
    const integrations = resolveOrganizationIntegrations(
      { activeApiKeyCount: 0, projectCount: 1 },
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
      connectHref: "/dashboard/alerts",
      configureHref: "/dashboard/alerts",
    });
  });

  it("exposes configure links for planned integrations", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 0,
    });

    expect(integrations.find((i) => i.id === "slack")).toMatchObject({
      availability: "planned",
      trackedIssue: 223,
      connectHref: "/dashboard/alerts",
    });
    expect(integrations.find((i) => i.id === "discord")).toMatchObject({
      trackedIssue: 224,
    });
  });
});
