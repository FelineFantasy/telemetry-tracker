import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const MAX_SLUG_LEN = 64;
/** Max stem length so `${stem}-${n}` fits in MAX_SLUG_LEN without truncating the counter. */
const SLUG_STEM_MAX = 52;

function trimDashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === 45 /* - */) start += 1;
  while (end > start && value.charCodeAt(end - 1) === 45 /* - */) end -= 1;
  return value.slice(start, end);
}

export function slugifyProjectName(name: string): string {
  // Trim separators before length clamp so a leading "-" does not consume a
  // character of the 64-char budget (matches pre-CodeQL slash-trim behavior).
  const s = trimDashes(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(
    0,
    MAX_SLUG_LEN
  );
  return s || "project";
}

/**
 * Allocate a unique `slug` per org. Soft-deleted rows still occupy slugs
 * (`@@unique([organization_id, slug])`). Pass `excludeProjectId` when renaming.
 */
export async function ensureUniqueProjectSlug(
  db: PrismaClient,
  orgId: string,
  base: string,
  excludeProjectId?: string
): Promise<string> {
  const stem =
    trimDashes(base.length <= SLUG_STEM_MAX ? base : base.slice(0, SLUG_STEM_MAX)) ||
    "project";
  let n = 0;
  while (n < 1_000_000) {
    const slug = n === 0 ? stem : `${stem}-${n}`.slice(0, MAX_SLUG_LEN);
    const clash = await db.project.findFirst({
      where: {
        organization_id: orgId,
        slug,
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return slug;
    n += 1;
  }
  for (let attempt = 0; attempt < 32; attempt++) {
    const suffix = randomBytes(5).toString("hex");
    const slug = `${stem}-${suffix}`.slice(0, MAX_SLUG_LEN);
    const clash = await db.project.findFirst({
      where: {
        organization_id: orgId,
        slug,
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return slug;
  }
  throw new Error("Could not allocate unique project slug");
}
