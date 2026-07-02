import { randomUUID } from "node:crypto";
import type { PrismaClient, SourceMapArtifact } from "@prisma/client";
import { z } from "zod";
import {
  findSourceMapArtifact,
  MAX_SOURCE_MAP_BYTES,
  ingestAppSchema,
  normalizeBundleUrl,
  normalizeMapAppLabel,
  normalizeMapReleaseLabel,
  sha256Hex,
} from "./source-map-artifact.js";
import { loadPlanContextForProject } from "./plan-enforcement.js";

const uploadBodySchema = z.object({
  app: ingestAppSchema,
  release: z.string().min(1).max(256).refine((value) => value.trim().length > 0),
  bundle_url: z.string().min(1).max(2048).refine((value) => value.trim().length > 0),
  /** Source map JSON as a string or parsed object. */
  content: z.union([z.string().min(1), z.record(z.unknown())]),
});

export type SourceMapUploadInput = z.infer<typeof uploadBodySchema>;

export type SourceMapArtifactSummary = {
  id: string;
  app: string;
  release: string;
  bundleUrl: string;
  sha256: string;
  sizeBytes: number;
  uploadedAt: string;
};

export function validateSourceMapUploadBody(
  body: unknown
): { ok: true; input: SourceMapUploadInput } | { ok: false; error: string } {
  const parsed = uploadBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid source map upload payload" };
  }
  const release = normalizeMapReleaseLabel(parsed.data.release);
  if (!release) {
    return { ok: false, error: "Invalid source map upload payload" };
  }
  return {
    ok: true,
    input: {
      ...parsed.data,
      app: normalizeMapAppLabel(parsed.data.app),
      release,
      bundle_url: normalizeBundleUrl(parsed.data.bundle_url),
    },
  };
}

/** Normalize and validate source map JSON (requires a numeric `version` field). */
export function parseSourceMapContent(
  content: string | Record<string, unknown>
): { ok: true; json: string } | { ok: false; error: string } {
  let raw: string;
  if (typeof content === "string") {
    raw = content;
  } else {
    try {
      raw = JSON.stringify(content);
    } catch {
      return { ok: false, error: "Source map content is not serializable JSON" };
    }
  }

  if (Buffer.byteLength(raw, "utf8") > MAX_SOURCE_MAP_BYTES) {
    return {
      ok: false,
      error: `Source map exceeds ${MAX_SOURCE_MAP_BYTES} byte limit`,
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Source map content is not valid JSON" };
  }

  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    typeof (value as { version: unknown }).version !== "number"
  ) {
    return { ok: false, error: "Source map JSON must include a numeric version field" };
  }

  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > MAX_SOURCE_MAP_BYTES) {
    return {
      ok: false,
      error: `Source map exceeds ${MAX_SOURCE_MAP_BYTES} byte limit`,
    };
  }

  return { ok: true, json };
}

const SOURCE_MAP_QUOTA_MSG =
  "Source map storage limit reached for this project (plan limit).";

/** Ensures a new artifact would stay within plan limits (replaces are always allowed). */
export async function checkSourceMapUploadQuota(
  prisma: PrismaClient,
  projectId: string,
  input: SourceMapUploadInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await findSourceMapArtifact(prisma, {
    projectId,
    app: input.app,
    release: input.release,
    bundleUrl: input.bundle_url,
  });
  if (existing) return { ok: true };

  const ctx = await loadPlanContextForProject(prisma, projectId);
  if (!ctx) return { ok: false, error: "Project not found." };

  const count = await prisma.sourceMapArtifact.count({
    where: { project_id: projectId },
  });
  if (count >= ctx.limits.maxSourceMapArtifactsPerProject) {
    return { ok: false, error: SOURCE_MAP_QUOTA_MSG };
  }
  return { ok: true };
}

export function toSourceMapArtifactSummary(row: SourceMapArtifact): SourceMapArtifactSummary {
  return {
    id: row.id,
    app: row.app,
    release: row.release,
    bundleUrl: row.bundle_url,
    sha256: row.sha256,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at.toISOString(),
  };
}

export async function upsertSourceMapArtifact(
  prisma: PrismaClient,
  projectId: string,
  input: SourceMapUploadInput
): Promise<
  | { ok: true; artifact: SourceMapArtifactSummary; created: boolean }
  | { ok: false; error: string }
> {
  const parsed = parseSourceMapContent(input.content);
  if (!parsed.ok) return parsed;

  const app = input.app;
  const release = input.release;
  const bundleUrl = normalizeBundleUrl(input.bundle_url);
  const sha256 = sha256Hex(parsed.json);
  const sizeBytes = Buffer.byteLength(parsed.json, "utf8");
  const data = {
    content: parsed.json,
    sha256,
    size_bytes: sizeBytes,
  };
  const where = {
    project_id_app_release_bundle_url: {
      project_id: projectId,
      app,
      release,
      bundle_url: bundleUrl,
    },
  };

  try {
    const row = await prisma.sourceMapArtifact.create({
      data: {
        id: randomUUID(),
        project_id: projectId,
        app,
        release,
        bundle_url: bundleUrl,
        ...data,
      },
    });
    return {
      ok: true,
      artifact: toSourceMapArtifactSummary(row),
      created: true,
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "P2002") throw error;
    const row = await prisma.sourceMapArtifact.update({
      where,
      data: { ...data, uploaded_at: new Date() },
    });
    return {
      ok: true,
      artifact: toSourceMapArtifactSummary(row),
      created: false,
    };
  }
}

export async function listSourceMapArtifactSummaries(
  prisma: PrismaClient,
  projectId: string,
  app: string,
  release: string
): Promise<SourceMapArtifactSummary[]> {
  const rows = await prisma.sourceMapArtifact.findMany({
    where: { project_id: projectId, app, release },
    orderBy: { uploaded_at: "desc" },
    select: {
      id: true,
      app: true,
      release: true,
      bundle_url: true,
      sha256: true,
      size_bytes: true,
      uploaded_at: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    app: row.app,
    release: row.release,
    bundleUrl: row.bundle_url,
    sha256: row.sha256,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at.toISOString(),
  }));
}
