import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ChangelogCategory =
  | "Added"
  | "Changed"
  | "Fixed"
  | "Removed"
  | "Deprecated"
  | "Security";

export type ChangelogRelease = {
  version: string;
  date: string | null;
  prerelease: boolean;
  categories: Partial<Record<ChangelogCategory, string[]>>;
  anchor: string;
};

const CATEGORY_RE =
  /^### (Added|Changed|Fixed|Removed|Deprecated|Security)\s*$/gm;

function resolveChangelogPath(): string {
  const candidates = [
    join(process.cwd(), "../../CHANGELOG.md"),
    join(process.cwd(), "CHANGELOG.md"),
    join(process.cwd(), "../../../CHANGELOG.md"),
  ];
  for (const path of candidates) {
    try {
      readFileSync(path, "utf8");
      return path;
    } catch {
      /* try next */
    }
  }
  throw new Error("CHANGELOG.md not found");
}

/** Markdown heading anchor for Keep a Changelog sections (e.g. `1.4.0---2026-07-03`). */
export function changelogAnchor(version: string, date: string | null): string {
  const slug = version.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  if (!date) return slug;
  const dateSlug = date.replace(/[^\d-]/g, "");
  return `${slug}---${dateSlug}`;
}

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  const blocks = markdown.split(/\n(?=## \[)/);

  for (const block of blocks) {
    const header = block.match(/^## \[([^\]]+)\]\s*-?\s*(.*)?$/m);
    if (!header) continue;

    const version = header[1]!.trim();
    const dateRaw = header[2]?.trim();
    const date = dateRaw && dateRaw.length > 0 ? dateRaw : null;
    const prerelease = version === "Unreleased";

    const categories: Partial<Record<ChangelogCategory, string[]>> = {};
    const headings = [...block.matchAll(CATEGORY_RE)];

    for (let i = 0; i < headings.length; i++) {
      const match = headings[i]!;
      const cat = match[1] as ChangelogCategory;
      const start = match.index! + match[0].length;
      const end = headings[i + 1]?.index ?? block.length;
      const body = block.slice(start, end);
      const items = body
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.replace(/^-\s+/, "").trim())
        .filter(Boolean);
      if (items.length > 0) categories[cat] = items;
    }

    if (Object.keys(categories).length === 0 && !prerelease) continue;

    releases.push({
      version,
      date,
      prerelease,
      categories,
      anchor: changelogAnchor(version, date),
    });
  }

  return releases;
}

export function loadChangelog(): ChangelogRelease[] {
  const path = resolveChangelogPath();
  return parseChangelog(readFileSync(path, "utf8"));
}

export const GITHUB_RELEASES_BASE =
  "https://github.com/Telemetry-Tracker/telemetry-tracker/releases/tag";
