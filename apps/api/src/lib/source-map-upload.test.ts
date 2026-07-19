import { describe, expect, it, vi } from "vitest";
import {
  SOURCE_MAP_QUOTA_MSG,
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

const artifactRow = {
  id: "sm-1",
  app: "web",
  release: "1.0.0",
  bundle_url: "https://cdn.example/app.js",
  sha256: "abc",
  size_bytes: 42,
  uploaded_at: new Date("2026-07-03T12:00:00.000Z"),
};

function makeUploadPrisma(opts: {
  existing?: { id: string } | null;
  count?: number;
  p2002OnCreate?: boolean;
}) {
  const findUnique = vi.fn(async () => opts.existing ?? null);
  const count = vi.fn(async () => opts.count ?? 0);
  const create = vi.fn(async () => {
    if (opts.p2002OnCreate) {
      const err = new Error("unique") as Error & { code: string };
      err.code = "P2002";
      throw err;
    }
    return artifactRow;
  });
  const update = vi.fn(async () => ({
    ...artifactRow,
    sha256: "def",
    uploaded_at: new Date("2026-07-03T12:00:01.000Z"),
  }));
  const tx = {
    sourceMapArtifact: { findUnique, count, create, update },
    project: {
      findFirst: vi.fn(async () => ({
        organization_id: "org-1",
      })),
    },
    organization: {
      findFirst: vi.fn(async () => ({
        plan_tier: "FREE",
        stripe_subscription_status: null,
        stripe_customer_id: null,
        stripe_current_period_end: null,
      })),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma, findUnique, count, create, update };
}

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
  const uploadInput = {
    app: "web",
    release: "1.0.0",
    bundle_url: "https://cdn.example/app.js",
    content: minimalMap,
  };

  it("creates a new artifact when under the plan cap", async () => {
    const { prisma, count, create } = makeUploadPrisma({ count: 0 });

    const result = await upsertSourceMapArtifact(prisma as never, "p1", uploadInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.artifact.bundleUrl).toBe("https://cdn.example/app.js");
    expect(count).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  });

  it("updates without counting quota when the artifact already exists", async () => {
    const { prisma, count, create, update } = makeUploadPrisma({
      existing: { id: "existing" },
      count: 25,
    });

    const result = await upsertSourceMapArtifact(prisma as never, "p1", uploadInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(false);
    expect(update).toHaveBeenCalledOnce();
    expect(count).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("updates and returns created false on unique conflict", async () => {
    const { prisma, update } = makeUploadPrisma({ count: 0, p2002OnCreate: true });

    const result = await upsertSourceMapArtifact(prisma as never, "p1", uploadInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(false);
    expect(update).toHaveBeenCalledOnce();
  });

  it("rejects new artifacts when at the plan cap inside the transaction", async () => {
    const { prisma, count, create } = makeUploadPrisma({ count: 25 });

    const result = await upsertSourceMapArtifact(prisma as never, "p1", uploadInput);

    expect(result).toEqual({ ok: false, error: SOURCE_MAP_QUOTA_MSG });
    expect(count).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });
});
