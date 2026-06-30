import { describe, expect, it } from "vitest";
import { resolveCanManageMembers } from "./dashboard-org-permissions";

describe("resolveCanManageMembers", () => {
  it("allows org owners from the members roster when session context is missing", () => {
    expect(
      resolveCanManageMembers({
        members: [{ userId: "u1", role: "OWNER" }],
        userId: "u1",
        sessionCanManageMembers: undefined,
      })
    ).toBe(true);
  });

  it("falls back to session-context when roster is unavailable", () => {
    expect(
      resolveCanManageMembers({
        members: null,
        userId: "u1",
        sessionCanManageMembers: true,
      })
    ).toBe(true);
  });

  it("denies non-owners when session context is also missing", () => {
    expect(
      resolveCanManageMembers({
        members: [{ userId: "u1", role: "EDITOR" }],
        userId: "u1",
        sessionCanManageMembers: false,
      })
    ).toBe(false);
  });
});
