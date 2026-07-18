/** Semver helpers for product update email automation (line-close policy). */

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

/** Display / ledger label for a minor line (e.g. `1.15` from `1.15.4`). */
export function formatMinorLineLabel(version: ReleaseSemver): string {
  return `${version.major}.${version.minor}`;
}

export type ShouldSendReleaseEmailOptions = {
  /** Closing the last intended release of a minor line — send even for Z-only tags. */
  lineClose?: boolean;
};

/**
 * Product update emails send on **line close**, not when opening a new minor/major.
 *
 * - `lineClose: true` → send (operator closing `vX.Y.*` before the next milestone)
 * - Opening a new line (`X` or `Y` increase, typically `*.*.0`) → skip
 * - Mid-line patch (Z-only) → skip
 * - No previous tag → send only with `lineClose` (bootstrap / first broadcast)
 */
export function shouldSendProductUpdateEmail(
  current: string,
  previous?: string | null,
  options: ShouldSendReleaseEmailOptions = {}
): ReleaseEmailBumpDecision {
  const cur = parseReleaseVersion(current);
  if (!cur) {
    return { send: false, reason: `invalid current version: ${current}` };
  }

  const lineLabel = formatMinorLineLabel(cur);
  const to = formatReleaseVersion(cur);

  if (options.lineClose) {
    const prevRaw = previous?.trim();
    if (!prevRaw) {
      return {
        send: true,
        reason: `line close of ${lineLabel} (${to}; no previous semver tag)`,
      };
    }

    const prev = parseReleaseVersion(prevRaw);
    if (!prev) {
      return { send: false, reason: `invalid previous tag (${prevRaw})` };
    }

    const from = formatReleaseVersion(prev);
    const cmp = compareReleaseVersion(cur, prev);
    if (cmp < 0) {
      return { send: false, reason: `not a forward semver release (${from} → ${to})` };
    }
    if (cmp === 0) {
      return {
        send: true,
        reason: `line close of ${lineLabel} (same tag ${to}; re-run / backfill)`,
      };
    }
    if (prev.major === cur.major && prev.minor === cur.minor) {
      return {
        send: false,
        reason: `previous_version ${from} is on the same minor line as ${to} — set previous_version to the previous minor final (or last emailed release outside ${lineLabel}) so the email covers the whole ${lineLabel}.* line`,
      };
    }
    return {
      send: true,
      reason: `line close of ${lineLabel} (${from} → ${to})`,
    };
  }

  const prevRaw = previous?.trim();
  if (!prevRaw) {
    return {
      send: false,
      reason:
        "no previous semver tag — use line_close / --line-close for the first product update email",
    };
  }

  const prev = parseReleaseVersion(prevRaw);
  if (!prev) {
    return { send: false, reason: `invalid previous tag (${prevRaw})` };
  }

  const from = formatReleaseVersion(prev);
  const cmp = compareReleaseVersion(cur, prev);
  if (cmp <= 0) {
    return { send: false, reason: `not a forward semver release (${from} → ${to})` };
  }

  if (cur.major !== prev.major || cur.minor !== prev.minor) {
    return {
      send: false,
      reason: `crossed minor/major (${from} → ${to}) — tag push skips; use line_close on the final release of the completed line`,
    };
  }

  return {
    send: false,
    reason: `patch-only release (${from} → ${to}) — mid-line patches skip; use line_close on the final release of ${lineLabel}`,
  };
}
