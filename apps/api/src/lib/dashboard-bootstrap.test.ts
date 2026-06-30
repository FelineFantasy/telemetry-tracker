import { describe, expect, it, vi } from "vitest";
import { buildDashboardBootstrap } from "./dashboard-bootstrap.js";
import * as workspaceMeta from "./workspace-meta.js";
import * as readProject from "./read-project-request.js";

describe("buildDashboardBootstrap", () => {
  it("returns organizations when org header is forbidden so the user can switch orgs", async () => {
    vi.spyOn(workspaceMeta, "loadWorkspaceMetaForUser").mockResolvedValue({
      organizations: [{ id: "org-a", name: "A" }],
      projects: [],
      forbiddenOrg: true,
    });
    vi.spyOn(readProject, "tryResolveReadProjectId").mockResolvedValue("proj-stale");

    const prisma = {
      user: {
        findUnique: async () => ({
          id: "user-1",
          email: "a@example.com",
          display_name: "A",
        }),
      },
    };

    const result = await buildDashboardBootstrap(
      prisma as never,
      { userId: "user-1", sessionId: "sess-1" },
      {} as never,
      "org-b"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.organizations).toEqual([{ id: "org-a", name: "A" }]);
    expect(result.payload.projects).toEqual([]);
    expect(result.payload.navScope).toEqual({ apps: [], environments: [] });
    expect(result.payload.user.email).toBe("a@example.com");
  });
});
