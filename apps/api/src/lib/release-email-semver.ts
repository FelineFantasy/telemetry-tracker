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

export type ReleaseEmailBumpDecision = {
  send: boolean;
  reason: string;
};

/**
 * Product update emails go out when X or Y changes (major/minor bump).
 * Patch-only releases (Z only) are skipped.
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
    return { send: true, reason: `invalid previous tag (${prevRaw}); sending to be safe` };
  }

  if (cur.major !== prev.major) {
    return { send: true, reason: `major bump (${prev.major}.${prev.minor}.${prev.patch} → ${cur.major}.${cur.minor}.${cur.patch})` };
  }
  if (cur.minor !== prev.minor) {
    return { send: true, reason: `minor bump (${prev.major}.${prev.minor}.${prev.patch} → ${cur.major}.${cur.minor}.${cur.patch})` };
  }

  return {
    send: false,
    reason: `patch-only release (${prev.major}.${prev.minor}.${prev.patch} → ${cur.major}.${cur.minor}.${cur.patch})`,
  };
}
