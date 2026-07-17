import { describe, expect, it } from "vitest";
import {
  applyNotificationFeedFilters,
  buildOrganizationDashboardNotifications,
  parseNotificationTypeFilter,
  type DashboardNotificationItem,
} from "./dashboard-notifications.js";
import type { DashboardSessionContextPayload } from "./dashboard-session-context.js";

const baseSession: DashboardSessionContextPayload = {
  projectId: "p1",
  role: "OWNER",
  canResolveErrors: true,
  canCreateApiKey: true,
  canRevokeApiKey: true,
  canCreateProject: true,
  canManageMembers: true,
  canArchiveOrganization: true,
  canArchiveProject: true,
  usageQuota: null,
  billingHealth: null,
};

const sampleItems: DashboardNotificationItem[] = [
  {
    id: "issue:1",
    type: "issue",
    title: "Error",
    body: "body",
    occurredAt: "2026-07-01T10:00:00.000Z",
    href: "/dashboard/errors/1",
    projectId: "p1",
    projectName: "Alpha",
  },
  {
    id: "alert:1",
    type: "alert",
    title: "Spike",
    body: "body",
    occurredAt: "2026-07-01T11:00:00.000Z",
    href: "/dashboard/errors",
    projectId: "p2",
    projectName: "Beta",
  },
  {
    id: "billing:past_due:org:2026-07-01",
    type: "billing",
    title: "Past due",
    body: "body",
    occurredAt: "2026-07-01T09:00:00.000Z",
    href: "/dashboard/settings/billing",
    projectId: null,
    projectName: null,
  },
];

describe("parseNotificationTypeFilter", () => {
  it("parses comma-separated types", () => {
    expect(parseNotificationTypeFilter("issue,alert")).toEqual(["issue", "alert"]);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseNotificationTypeFilter("")).toBeNull();
    expect(parseNotificationTypeFilter("nope")).toBeNull();
    expect(parseNotificationTypeFilter(undefined)).toBeNull();
  });
});

describe("applyNotificationFeedFilters", () => {
  it("filters by type and project", () => {
    expect(
      applyNotificationFeedFilters(sampleItems, {
        types: ["issue"],
        projectId: "p1",
      }).map((i) => i.id)
    ).toEqual(["issue:1"]);
  });

  it("excludes org-level items when filtering by project", () => {
    expect(
      applyNotificationFeedFilters(sampleItems, { projectId: "p1" }).map((i) => i.id)
    ).toEqual(["issue:1"]);
  });

  it("matches projectId case-insensitively", () => {
    const mixedCase: DashboardNotificationItem[] = [
      {
        ...sampleItems[0],
        id: "issue:uuid",
        projectId: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
      },
      sampleItems[2],
    ];
    expect(
      applyNotificationFeedFilters(mixedCase, {
        projectId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }).map((i) => i.id)
    ).toEqual(["issue:uuid"]);
  });
});

describe("buildOrganizationDashboardNotifications", () => {
  it("tags alerts and issues with project metadata across projects", async () => {
    const prisma = {
      alertEvent: {
        findMany: async () => [
          {
            project_id: "p2",
            rule: "ERROR_SPIKE",
            title: "Error rate spike",
            body: "up",
            href: "/dashboard/errors",
            dedupe_key: "error-spike:p2:1",
            fired_at: new Date("2026-07-02T10:00:00.000Z"),
          },
        ],
      },
      errorGroup: {
        findMany: async () => [
          {
            id: "eg1",
            project_id: "p1",
            message: "boom",
            app: "web",
            environment: "production",
            occurrences: 3,
            last_seen: new Date("2026-07-02T09:00:00.000Z"),
          },
        ],
      },
      project: {
        findFirst: async () => null,
      },
      usageMonthly: {
        findUnique: async () => null,
      },
    } as never;

    const items = await buildOrganizationDashboardNotifications(
      prisma,
      [
        { id: "p1", name: "Alpha" },
        { id: "p2", name: "Beta" },
      ],
      "p1",
      baseSession
    );

    const alert = items.find((i) => i.id === "error-spike:p2:1");
    expect(alert).toMatchObject({
      type: "alert",
      projectId: "p2",
      projectName: "Beta",
    });
    const issue = items.find((i) => i.id === "issue:eg1");
    expect(issue).toMatchObject({
      type: "issue",
      projectId: "p1",
      projectName: "Alpha",
    });
  });

  it("scopes issue and alert queries to the filtered project before take", async () => {
    const issueWheres: unknown[] = [];
    const alertWheres: unknown[] = [];
    const prisma = {
      alertEvent: {
        findMany: async (args: { where: unknown }) => {
          alertWheres.push(args.where);
          return [
            {
              project_id: "p2",
              rule: "ERROR_SPIKE",
              title: "Quiet project alert",
              body: "up",
              href: "/dashboard/errors",
              dedupe_key: "error-spike:p2:quiet",
              fired_at: new Date("2026-07-02T10:00:00.000Z"),
            },
          ];
        },
      },
      errorGroup: {
        findMany: async (args: { where: unknown }) => {
          issueWheres.push(args.where);
          return [
            {
              id: "eg-quiet",
              project_id: "p2",
              message: "quiet boom",
              app: "web",
              environment: "production",
              occurrences: 1,
              last_seen: new Date("2026-07-02T09:00:00.000Z"),
            },
          ];
        },
      },
      project: {
        findFirst: async () => null,
      },
      usageMonthly: {
        findUnique: async () => null,
      },
    } as never;

    // Callers (GET /meta/notifications) must pass only the filtered project so
    // its issues/alerts are not crowded out by a global org-wide take.
    const items = await buildOrganizationDashboardNotifications(
      prisma,
      [{ id: "p2", name: "Beta" }],
      "p1",
      baseSession
    );

    expect(issueWheres).toEqual([
      {
        project_id: { in: ["p2"] },
        resolved_at: null,
      },
    ]);
    expect(alertWheres[0]).toMatchObject({
      project_id: { in: ["p2"] },
    });
    expect(items.map((i) => i.id)).toEqual(
      expect.arrayContaining(["issue:eg-quiet", "error-spike:p2:quiet"])
    );
  });
});
