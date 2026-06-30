import { describe, expect, it } from "vitest";
import { loadWorkspaceMetaForUser } from "./workspace-meta.js";

describe("loadWorkspaceMetaForUser", () => {
  it("flags forbidden org header without returning projects", async () => {
    const prisma = {
      organizationMembership: {
        findMany: async () => [
          {
            organization_id: "org-a",
            organization: { id: "org-a", name: "A" },
          },
        ],
      },
      project: {
        findMany: async () => {
          throw new Error("should not load projects when org header is forbidden");
        },
      },
    };

    const result = await loadWorkspaceMetaForUser(
      prisma as never,
      "user-1",
      "org-b"
    );

    expect(result.forbiddenOrg).toBe(true);
    expect(result.projects).toEqual([]);
    expect(result.organizations).toEqual([{ id: "org-a", name: "A" }]);
  });
});
