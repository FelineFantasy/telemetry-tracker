import { describe, expect, it } from "vitest";
import {
  loadOrganizationIntegrationSignals,
  resolveOrganizationIntegrations,
} from "./organization-integrations.js";

describe("organization-integrations", () => {
  it("marks SDK connected when the org has active API keys", async () => {
    const prisma = {
      project: {
        findMany: async () => [
          { id: "proj-1", alert_settings: null },
          { id: "proj-2", alert_settings: null },
        ],
      },
      apiKey: {
        count: async () => 2,
      },
    };

    const signals = await loadOrganizationIntegrationSignals(prisma as never, "org-1");
    const integrations = resolveOrganizationIntegrations(signals);

    expect(signals).toEqual({
      activeApiKeyCount: 2,
      projectCount: 2,
      alertsEnabledProjectCount: 2,
    });
    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("connected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("connected");
    expect(integrations.find((i) => i.id === "slack")?.status).toBe("disconnected");
    expect(integrations.find((i) => i.id === "webhooks")?.status).toBe("disconnected");
  });

  it("marks SDK and email alerts disconnected for an empty org", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 0,
      alertsEnabledProjectCount: 0,
    });

    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("disconnected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("disconnected");
  });

  it("marks email alerts disconnected when all alert channels are disabled", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 1,
      projectCount: 1,
      alertsEnabledProjectCount: 0,
    });

    expect(integrations.find((i) => i.id === "sdk")?.status).toBe("connected");
    expect(integrations.find((i) => i.id === "email_alerts")?.status).toBe("disconnected");
  });

  it("exposes configure links for planned integrations", () => {
    const integrations = resolveOrganizationIntegrations({
      activeApiKeyCount: 0,
      projectCount: 0,
      alertsEnabledProjectCount: 0,
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
