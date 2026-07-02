import { createHash } from "node:crypto";
import type { PrismaClient, SourceMapArtifact } from "@prisma/client";

/** Max source map JSON size per artifact (upload API enforces in phase 3). */
export const MAX_SOURCE_MAP_BYTES = 10 * 1024 * 1024;

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
  return prisma.sourceMapArtifact.findUnique({
    where: {
      project_id_app_release_bundle_url: {
        project_id: key.projectId,
        app: key.app,
        release: key.release,
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
  return prisma.sourceMapArtifact.findMany({
    where: { project_id: projectId, app, release },
    orderBy: { uploaded_at: "desc" },
  });
}
