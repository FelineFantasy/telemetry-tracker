import { createHash } from "node:crypto";
import type { PrismaClient, SourceMapArtifact } from "@prisma/client";
import { z } from "zod";

/** Max source map JSON size per artifact (upload API enforces in phase 3). */
export const MAX_SOURCE_MAP_BYTES = 10 * 1024 * 1024;

/** Fastify `bodyLimit` for POST /api/project/source-maps (map JSON + request envelope). */
export const SOURCE_MAP_UPLOAD_BODY_LIMIT = MAX_SOURCE_MAP_BYTES + 256 * 1024;

/** Max bundle refs loaded per release during symbolication (metadata only). */
export const MAX_SOURCE_MAP_BUNDLES_PER_RELEASE = 128;

/** Max map contents loaded per error detail symbolication request. */
export const MAX_SOURCE_MAP_CONTENT_LOADS_PER_DETAIL = 32;

/** Zod field for ingest/upload app labels (non-empty after trim). */
export const ingestAppSchema = z.string().trim().min(1).max(128);

/** Trim app labels so ingest telemetry and uploaded maps share the same key. */
export function normalizeMapAppLabel(app: string): string {
  return app.trim();
}

/** Trim release labels; blank after trim becomes null (optional on errors). */
export function normalizeMapReleaseLabel(
  release: string | null | undefined
): string | null {
  if (release == null) return null;
  const trimmed = release.trim();
  return trimmed === "" ? null : trimmed;
}

export type SourceMapArtifactKey = {
  projectId: string;
  app: string;
  release: string;
  bundleUrl: string;
};

export function normalizeBundleUrl(bundleUrl: string): string {
  return bundleUrl.trim();
}

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function findSourceMapArtifact(
  prisma: PrismaClient,
  key: SourceMapArtifactKey
): Promise<SourceMapArtifact | null> {
  const app = normalizeMapAppLabel(key.app);
  const release = normalizeMapReleaseLabel(key.release) ?? key.release;
  return prisma.sourceMapArtifact.findUnique({
    where: {
      project_id_app_release_bundle_url: {
        project_id: key.projectId,
        app,
        release,
        bundle_url: normalizeBundleUrl(key.bundleUrl),
      },
    },
  });
}

export async function listSourceMapArtifactsForRelease(
  prisma: PrismaClient,
  projectId: string,
  app: string,
  release: string
): Promise<SourceMapArtifact[]> {
  const appLabel = normalizeMapAppLabel(app);
  const releaseLabel = normalizeMapReleaseLabel(release) ?? release;
  return prisma.sourceMapArtifact.findMany({
    where: { project_id: projectId, app: appLabel, release: releaseLabel },
    orderBy: { uploaded_at: "desc" },
  });
}

export type SourceMapArtifactRef = {
  id: string;
  bundle_url: string;
};

export async function listSourceMapArtifactRefsForRelease(
  prisma: PrismaClient,
  projectId: string,
  app: string,
  release: string
): Promise<SourceMapArtifactRef[]> {
  const appLabel = normalizeMapAppLabel(app);
  const releaseLabel = normalizeMapReleaseLabel(release) ?? release;
  return prisma.sourceMapArtifact.findMany({
    where: { project_id: projectId, app: appLabel, release: releaseLabel },
    select: { id: true, bundle_url: true },
    orderBy: { uploaded_at: "desc" },
    take: MAX_SOURCE_MAP_BUNDLES_PER_RELEASE,
  });
}

export async function getSourceMapArtifactContentById(
  prisma: PrismaClient,
  id: string
): Promise<Pick<SourceMapArtifact, "bundle_url" | "content"> | null> {
  return prisma.sourceMapArtifact.findUnique({
    where: { id },
    select: { bundle_url: true, content: true },
  });
}
