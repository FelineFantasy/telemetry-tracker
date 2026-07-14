import { createHash } from "node:crypto";
import { stableStringify } from "./brief-snapshot-hash.js";

export type PresentationHashInput = {
  organizationId: string;
  organizationName: string;
  projects: Array<{
    projectId: string;
    projectName: string;
    projectSlug: string;
  }>;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Presentation identity for semantic cache invalidation on rename/slug changes. */
export function computePresentationHash(input: PresentationHashInput): string {
  const projection = {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    projects: [...input.projects]
      .sort((a, b) => a.projectId.localeCompare(b.projectId))
      .map(({ projectId, projectName, projectSlug }) => ({
        projectId,
        projectName,
        projectSlug,
      })),
  };
  return sha256Hex(stableStringify(projection));
}
