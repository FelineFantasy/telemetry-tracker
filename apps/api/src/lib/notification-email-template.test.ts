import { describe, expect, it } from "vitest";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";
import {
  buildNotificationEmailHtml,
  buildNotificationEmailSubject,
  inferNotificationEmailKind,
} from "./notification-email-template.js";

const ORIGIN = "https://app.example.com";

function item(
  partial: Partial<DashboardNotificationItem> &
    Pick<DashboardNotificationItem, "id" | "type" | "title" | "body">
): DashboardNotificationItem {
  return {
    occurredAt: new Date().toISOString(),
    href: "/dashboard/errors",
    ...partial,
  };
}

describe("inferNotificationEmailKind", () => {
  it("maps alert rules and ids", () => {
    expect(
      inferNotificationEmailKind(
        item({ id: "x", type: "alert", title: "t", body: "b" }),
        "ERROR_SPIKE"
      )
    ).toBe("error_spike");
    expect(
      inferNotificationEmailKind(
        item({
          id: "quota:near:p1:2026-07",
          type: "alert",
          title: "t",
          body: "b",
        })
      )
    ).toBe("quota_near");
    expect(
      inferNotificationEmailKind(
        item({ id: "alert:custom:1", type: "alert", title: "t", body: "b" })
      )
    ).toBe("custom_alert");
    expect(
      inferNotificationEmailKind(
        item({ id: "issue:1", type: "issue", title: "t", body: "b" })
      )
    ).toBe("new_error");
  });
});

describe("buildNotificationEmailHtml", () => {
  it("renders branded spike template with CTA and project", () => {
    const html = buildNotificationEmailHtml({
      item: item({
        id: "alert:error_spike:p1:15:1",
        type: "alert",
        title: "Error spike detected",
        body: "42 errors in the last 15 minutes.",
        href: "/dashboard/errors",
      }),
      kind: "error_spike",
      dashboardOrigin: ORIGIN,
      projectName: "Acme Web",
    });
    expect(html).toContain("Error spike");
    expect(html).toContain("Error spike detected");
    expect(html).toContain("Acme Web");
    expect(html).toContain(`${ORIGIN}/dashboard/errors`);
    expect(html).toContain("View errors");
    expect(html).toContain("Manage notification preferences");
  });

  it("escapes HTML in title and body", () => {
    const html = buildNotificationEmailHtml({
      item: item({
        id: "issue:1",
        type: "issue",
        title: `<script>alert(1)</script>`,
        body: `a <b>b</b>`,
      }),
      kind: "new_error",
      dashboardOrigin: ORIGIN,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("buildNotificationEmailSubject", () => {
  it("prefixes by kind", () => {
    expect(
      buildNotificationEmailSubject(
        item({
          id: "1",
          type: "alert",
          title: "Error spike detected",
          body: "x",
        }),
        "error_spike"
      )
    ).toBe("[Error spike] Error spike detected");
  });
});
