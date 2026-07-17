import { describe, expect, it, vi } from "vitest";
import { ensureUniqueProjectSlug, slugifyProjectName } from "./project-slug.js";

describe("slugifyProjectName", () => {
  it("normalizes names", () => {
    expect(slugifyProjectName("My Cool App!")).toBe("my-cool-app");
    expect(slugifyProjectName("  ---  ")).toBe("project");
  });
});

describe("ensureUniqueProjectSlug", () => {
  it("returns base when free", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = { project: { findFirst } } as never;
    await expect(ensureUniqueProjectSlug(db, "org-1", "acme")).resolves.toBe("acme");
  });

  it("skips the project being renamed", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = { project: { findFirst } } as never;
    await ensureUniqueProjectSlug(db, "org-1", "acme", "proj-1");
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        organization_id: "org-1",
        slug: "acme",
        id: { not: "proj-1" },
      },
      select: { id: true },
    });
  });

  it("appends a counter when taken", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "other" })
      .mockResolvedValueOnce(null);
    const db = { project: { findFirst } } as never;
    await expect(ensureUniqueProjectSlug(db, "org-1", "acme")).resolves.toBe(
      "acme-1"
    );
  });
});
