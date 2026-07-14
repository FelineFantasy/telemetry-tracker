import { describe, expect, it } from "vitest";
import { computePresentationHash } from "./brief-presentation-hash.js";

const base = {
  organizationId: "c0000000-0000-4000-8000-000000000004",
  organizationName: "Acme Corp",
  projects: [
    {
      projectId: "a0000000-0000-4000-8000-000000000001",
      projectName: "Alpha",
      projectSlug: "alpha",
    },
    {
      projectId: "b0000000-0000-4000-8000-000000000002",
      projectName: "Beta",
      projectSlug: "beta",
    },
  ],
};

describe("computePresentationHash", () => {
  it("is stable for the same presentation metadata", () => {
    expect(computePresentationHash(base)).toBe(computePresentationHash(base));
  });

  it("is order-independent for projects", () => {
    const reversed = {
      ...base,
      projects: [...base.projects].reverse(),
    };
    expect(computePresentationHash(reversed)).toBe(computePresentationHash(base));
  });

  it("changes when organization name changes", () => {
    const renamed = { ...base, organizationName: "Acme Incorporated" };
    expect(computePresentationHash(renamed)).not.toBe(computePresentationHash(base));
  });

  it("changes when project slug changes", () => {
    const slugChanged = {
      ...base,
      projects: base.projects.map((p) =>
        p.projectId === "a0000000-0000-4000-8000-000000000001"
          ? { ...p, projectSlug: "alpha-renamed" }
          : p
      ),
    };
    expect(computePresentationHash(slugChanged)).not.toBe(computePresentationHash(base));
  });

  it("changes when project name changes", () => {
    const nameChanged = {
      ...base,
      projects: base.projects.map((p) =>
        p.projectId === "b0000000-0000-4000-8000-000000000002"
          ? { ...p, projectName: "Beta Renamed" }
          : p
      ),
    };
    expect(computePresentationHash(nameChanged)).not.toBe(computePresentationHash(base));
  });
});
