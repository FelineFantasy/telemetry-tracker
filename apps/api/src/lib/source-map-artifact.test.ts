import { describe, expect, it, vi } from "vitest";
import {
  findSourceMapArtifact,
  normalizeBundleUrl,
  normalizeMapAppLabel,
  normalizeMapReleaseLabel,
  sha256Hex,
} from "./source-map-artifact.js";

describe("source-map-artifact", () => {
  it("normalizes map app and release labels", () => {
    expect(normalizeMapAppLabel("  web  ")).toBe("web");
    expect(normalizeMapReleaseLabel(" 1.2.0 ")).toBe("1.2.0");
    expect(normalizeMapReleaseLabel("   ")).toBeNull();
    expect(normalizeMapReleaseLabel(undefined)).toBeNull();
  });

  it("normalizes bundle URLs", () => {
    expect(normalizeBundleUrl("  https://cdn.example/app.js  ")).toBe(
      "https://cdn.example/app.js"
    );
  });

  it("hashes content for integrity checks", () => {
    expect(sha256Hex("{}")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("finds artifact by project, app, release, and bundle_url", async () => {
    const artifact = { id: "sm-1", content: "{}" };
    const findUnique = vi.fn(async () => artifact);
    const prisma = { sourceMapArtifact: { findUnique } };

    const result = await findSourceMapArtifact(prisma as never, {
      projectId: "p1",
      app: "  web  ",
      release: " 1.0.0 ",
      bundleUrl: "https://cdn.example/app.js",
    });

    expect(result).toBe(artifact);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        project_id_app_release_bundle_url: {
          project_id: "p1",
          app: "web",
          release: "1.0.0",
          bundle_url: "https://cdn.example/app.js",
        },
      },
    });
  });
});
