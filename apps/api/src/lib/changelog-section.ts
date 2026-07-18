import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareReleaseVersion,
  formatMinorLineLabel,
  parseReleaseVersion,
  type ReleaseSemver,
} from "./release-email-semver.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract body text for a semver or [Unreleased] section from CHANGELOG markdown. */
export function extractChangelogSectionFromContent(
  content: string,
  version: string
): string | null {
  const headerRe =
    version === "Unreleased"
      ? /^## \[Unreleased\][^\n]*\n/m
      : new RegExp(`^## \\[${escapeRegex(version)}\\][^\\n]*\\n`, "m");
  const match = content.match(headerRe);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeader = rest.search(/\n## \[/);
  const section = (nextHeader === -1 ? rest : rest.slice(0, nextHeader)).trim();
  if (!section || section === "---") return null;
  return section;
}

export type ChangelogMinorLineResult = {
  /** Minor line label for subject / ledger (e.g. `1.15`). */
  lineLabel: string;
  /** Semver tags included, ascending. */
  versions: string[];
  /** Concatenated CHANGELOG bodies for the line. */
  sectionMarkdown: string;
};

function formatVersion(version: ReleaseSemver): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Collect all CHANGELOG sections for the minor line of `closingVersion` (same X.Y),
 * optionally only versions strictly after `previousVersion` and up through `closingVersion`.
 */
export function extractChangelogMinorLineFromContent(
  content: string,
  options: {
    closingVersion: string;
    previousVersion?: string | null;
  }
): ChangelogMinorLineResult | null {
  const closing = parseReleaseVersion(options.closingVersion);
  if (!closing) return null;

  const previous = options.previousVersion?.trim()
    ? parseReleaseVersion(options.previousVersion)
    : null;
  if (options.previousVersion?.trim() && !previous) return null;

  const headerRe = /^## \[(\d+\.\d+\.\d+)\][^\n]*\n/gm;
  const matches: Array<{ version: ReleaseSemver; index: number; headerLength: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(content)) !== null) {
    const parsed = parseReleaseVersion(match[1]!);
    if (!parsed) continue;
    if (parsed.major !== closing.major || parsed.minor !== closing.minor) continue;
    if (compareReleaseVersion(parsed, closing) > 0) continue;
    if (previous && compareReleaseVersion(parsed, previous) <= 0) continue;
    matches.push({
      version: parsed,
      index: match.index,
      headerLength: match[0].length,
    });
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => compareReleaseVersion(a.version, b.version));

  const parts: string[] = [];
  const versions: string[] = [];
  for (const entry of matches) {
    const start = entry.index + entry.headerLength;
    const rest = content.slice(start);
    const nextHeader = rest.search(/\n## \[/);
    const body = (nextHeader === -1 ? rest : rest.slice(0, nextHeader)).trim();
    if (!body || body === "---") continue;
    const label = formatVersion(entry.version);
    versions.push(label);
    parts.push(`### ${label}\n\n${body}`);
  }

  if (parts.length === 0) return null;

  return {
    lineLabel: formatMinorLineLabel(closing),
    versions,
    sectionMarkdown: parts.join("\n\n"),
  };
}

/** Resolve repo-root CHANGELOG.md from this module (stable regardless of process cwd). */
export function resolveChangelogPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../../CHANGELOG.md");
}

export function loadChangelogSection(version: string): string | null {
  const content = readFileSync(resolveChangelogPath(), "utf8");
  return extractChangelogSectionFromContent(content, version);
}

export function loadChangelogMinorLine(options: {
  closingVersion: string;
  previousVersion?: string | null;
}): ChangelogMinorLineResult | null {
  const content = readFileSync(resolveChangelogPath(), "utf8");
  return extractChangelogMinorLineFromContent(content, options);
}
