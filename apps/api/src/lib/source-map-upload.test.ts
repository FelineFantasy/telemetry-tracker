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

  it("rejects whitespace-only app and release", () => {
    expect(
      validateSourceMapUploadBody({
        app: "   ",
        release: "1.0.0",
        bundle_url: "https://cdn.example/app.js",
        content: minimalMap,
      })
    ).toEqual({ ok: false, error: "Invalid source map upload payload" });
    expect(
      validateSourceMapUploadBody({
        app: "web",
        release: "\t\n",
        bundle_url: "https://cdn.example/app.js",
        content: minimalMap,
      })
    ).toEqual({ ok: false, error: "Invalid source map upload payload" });
  });

  it("trims app and release before returning input", () => {
    const result = validateSourceMapUploadBody({
      app: "  web  ",
      release: " 1.0.0 ",
      bundle_url: "https://cdn.example/app.js",
      content: minimalMap,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.app).toBe("web");
    expect(result.input.release).toBe("1.0.0");
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
    const create = vi.fn(async () => ({
      id: "sm-1",
      app: "web",
      release: "1.0.0",
      bundle_url: "https://cdn.example/app.js",
      sha256: "abc",
      size_bytes: 42,
      uploaded_at: new Date("2026-07-03T12:00:00.000Z"),
    }));
    const prisma = {
      sourceMapArtifact: { create, update: vi.fn() },
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
    expect(create).toHaveBeenCalledOnce();
  });

  it("updates and returns created false on unique conflict", async () => {
    const create = vi.fn(async () => {
      const err = new Error("unique") as Error & { code: string };
      err.code = "P2002";
      throw err;
    });
    const update = vi.fn(async () => ({
      id: "sm-1",
      app: "web",
      release: "1.0.0",
      bundle_url: "https://cdn.example/app.js",
      sha256: "def",
      size_bytes: 42,
      uploaded_at: new Date("2026-07-03T12:00:01.000Z"),
    }));
    const prisma = {
      sourceMapArtifact: { create, update },
    };

    const result = await upsertSourceMapArtifact(prisma as never, "p1", {
      app: "web",
      release: "1.0.0",
      bundle_url: "https://cdn.example/app.js",
      content: minimalMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(false);
    expect(update).toHaveBeenCalledOnce();
  });
});
