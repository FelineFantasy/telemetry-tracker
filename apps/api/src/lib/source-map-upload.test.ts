import { describe, expect, it, vi } from "vitest";
import {
  parseSourceMapContent,
  upsertSourceMapArtifact,
  validateSourceMapUploadBody,
} from "./source-map-upload.js";

const minimalMap = {
  version: 3,
  sources: ["src/index.ts"],
  names: [],
  mappings: "AAAA",
};

describe("validateSourceMapUploadBody", () => {
  it("accepts a valid payload", () => {
    const result = validateSourceMapUploadBody({
      app: "web",
      release: "1.0.0",
      bundle_url: "https://cdn.example/app.js",
      content: minimalMap,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing app", () => {
    const result = validateSourceMapUploadBody({
      app: "",
      release: "1.0.0",
      bundle_url: "https://cdn.example/app.js",
      content: minimalMap,
    });
    expect(result).toEqual({ ok: false, error: "Invalid source map upload payload" });
  });
});

describe("parseSourceMapContent", () => {
  it("accepts valid source map JSON", () => {
    const result = parseSourceMapContent(minimalMap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.json).version).toBe(3);
  });

  it("rejects JSON without version", () => {
    expect(parseSourceMapContent({ sources: [] })).toEqual({
      ok: false,
      error: "Source map JSON must include a numeric version field",
    });
  });
});

describe("upsertSourceMapArtifact", () => {
  it("creates a new artifact", async () => {
    const upsert = vi.fn(async () => ({
      id: "sm-1",
      app: "web",
      release: "1.0.0",
      bundle_url: "https://cdn.example/app.js",
      sha256: "abc",
      size_bytes: 42,
      uploaded_at: new Date("2026-07-03T12:00:00.000Z"),
    }));
    const findUnique = vi.fn(async () => null);
    const prisma = {
      sourceMapArtifact: { findUnique, upsert },
    };

    const result = await upsertSourceMapArtifact(prisma as never, "p1", {
      app: "web",
      release: "1.0.0",
      bundle_url: "https://cdn.example/app.js",
      content: minimalMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.artifact.bundleUrl).toBe("https://cdn.example/app.js");
    expect(upsert).toHaveBeenCalledOnce();
  });
});
