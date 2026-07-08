/** Semver helpers for product update email automation (minor/major tags only). */

export type ReleaseSemver = {
  major: number;
  minor: number;
  patch: number;
};

export function parseReleaseVersion(input: string): ReleaseSemver | null {
  const trimmed = input.trim().replace(/^v/i, "");
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(trimmed);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareReleaseVersion(a: ReleaseSemver, b: ReleaseSemver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export type ReleaseEmailBumpDecision = {
  send: boolean;
  reason: string;
};

function formatReleaseVersion(version: ReleaseSemver): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Product update emails go out on forward MINOR/MAJOR releases (X or Y increases).
 * Patch-only and downgrades are skipped.
 */
export function isMinorOrMajorBump(
  current: string,
  previous?: string | null
): ReleaseEmailBumpDecision {
  const cur = parseReleaseVersion(current);
  if (!cur) {
    return { send: false, reason: `invalid current version: ${current}` };
  }

  const prevRaw = previous?.trim();
  if (!prevRaw) {
    return { send: true, reason: "no previous semver tag" };
  }

  const prev = parseReleaseVersion(prevRaw);
  if (!prev) {
    return { send: false, reason: `invalid previous tag (${prevRaw})` };
  }

  const from = formatReleaseVersion(prev);
  const to = formatReleaseVersion(cur);
  const cmp = compareReleaseVersion(cur, prev);
  if (cmp <= 0) {
    return { send: false, reason: `not a forward semver release (${from} → ${to})` };
  }

  if (cur.major !== prev.major) {
    return { send: true, reason: `major bump (${from} → ${to})` };
  }
  if (cur.minor !== prev.minor) {
    return { send: true, reason: `minor bump (${from} → ${to})` };
  }

  return {
    send: false,
    reason: `patch-only release (${from} → ${to})`,
  };
}
