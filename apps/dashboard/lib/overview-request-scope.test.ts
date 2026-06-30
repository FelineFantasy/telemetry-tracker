import { describe, expect, it } from "vitest";
import {
  organizationCookieDiffersFromResolved,
} from "@/lib/dashboard-org";
import {
  overviewScopeMatches,
  shouldReuseOverviewEarlyFetch,
} from "@/lib/overview-request-scope";

describe("overview request scope", () => {
  it("detects stale org cookie vs resolved sidebar org", () => {
    expect(
      organizationCookieDiffersFromResolved("org-b", "org-a")
    ).toBe(true);
    expect(
      organizationCookieDiffersFromResolved("org-a", "org-a")
    ).toBe(false);
  });

  it("does not reuse early overview when effective project is empty", () => {
    const cookieScope = {
      projectId: "proj-stale",
      organizationId: "org-b",
    };
    const resolvedScope = {
      projectId: "",
      organizationId: "org-a",
    };

    expect(overviewScopeMatches(cookieScope, resolvedScope)).toBe(false);
    expect(
      shouldReuseOverviewEarlyFetch(cookieScope, resolvedScope, "")
    ).toBe(false);
  });

  it("reuses early overview only when cookie and resolved scope match", () => {
    const scope = { projectId: "proj-1", organizationId: "org-a" };
    expect(shouldReuseOverviewEarlyFetch(scope, scope, "proj-1")).toBe(true);
    expect(
      shouldReuseOverviewEarlyFetch(
        { projectId: "proj-1", organizationId: "org-a" },
        { projectId: "proj-2", organizationId: "org-a" },
        "proj-2"
      )
    ).toBe(false);
  });
});
