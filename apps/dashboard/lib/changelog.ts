import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ChangelogCategory =
  | "Added"
  | "Changed"
  | "Fixed"
  | "Removed"
  | "Deprecated"
  | "Security";

export type ChangelogContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string | null; code: string };

export type ChangelogReleaseSection =
  | { kind: "category"; category: ChangelogCategory; items: string[] }
  | { kind: "custom"; title: string; blocks: ChangelogContentBlock[] };

export type ChangelogRelease = {
  version: string;
  date: string | null;
  prerelease: boolean;
  /** Prose paragraphs before ### headings (no lists). */
  summary: string[];
  /** Category and custom sections in document order. */
  sections: ChangelogReleaseSection[];
  anchor: string;
};

const STANDARD_CATEGORIES = new Set<ChangelogCategory>([
  "Added",
  "Changed",
  "Fixed",
  "Removed",
  "Deprecated",
  "Security",
]);

const HEADING_RE = /^### (.+)\s*$/gm;

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

function extractListItems(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter(Boolean);
}

/** Parse prose, lists, and fenced code blocks for custom ### sections (Database, SDK compatibility, …). */
export function parseCustomSectionBody(body: string): ChangelogContentBlock[] {
  const blocks: ChangelogContentBlock[] = [];
  const parts = body.split(/(```[\s\S]*?```)/g);

  for (const part of parts) {
    if (part.startsWith("```")) {
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (match) {
        blocks.push({
          type: "code",
          language: match[1] || null,
          code: match[2]!.trim(),
        });
      }
      continue;
    }

    let paragraph: string[] = [];
    let list: string[] = [];

    const flushParagraph = () => {
      const text = paragraph.join(" ").trim();
      if (text) blocks.push({ type: "paragraph", text });
      paragraph = [];
    };

    const flushList = () => {
      if (list.length > 0) blocks.push({ type: "list", items: list });
      list = [];
    };

    for (const line of part.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "---") {
        flushParagraph();
        flushList();
        continue;
      }
      if (trimmed.startsWith("- ")) {
        flushParagraph();
        list.push(trimmed.replace(/^-\s+/, ""));
      } else {
        flushList();
        paragraph.push(trimmed);
      }
    }

    flushParagraph();
    flushList();
  }

  return blocks;
}

/** Paragraphs between the version heading and the first ### heading (or end of section). */
export function extractChangelogSummary(block: string): string[] {
  const withoutHeader = block.replace(/^## \[[^\]]+\][^\n]*\n?/, "");
  const prosePart = withoutHeader.split(/\n(?=### )/m)[0] ?? "";

  return prosePart
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "---" && !line.startsWith("- "));
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
    const summary = extractChangelogSummary(block);

    const sections: ChangelogReleaseSection[] = [];
    const headings = [...block.matchAll(HEADING_RE)];

    for (let i = 0; i < headings.length; i++) {
      const title = headings[i]![1]!.trim();
      const start = headings[i]!.index! + headings[i]![0].length;
      const end = headings[i + 1]?.index ?? block.length;
      const body = block.slice(start, end);

      if (STANDARD_CATEGORIES.has(title as ChangelogCategory)) {
        const items = extractListItems(body);
        if (items.length > 0) {
          sections.push({
            kind: "category",
            category: title as ChangelogCategory,
            items,
          });
        }
      } else {
        const customBlocks = parseCustomSectionBody(body);
        if (customBlocks.length > 0) {
          sections.push({ kind: "custom", title, blocks: customBlocks });
        }
      }
    }

    const hasContent = summary.length > 0 || sections.length > 0 || prerelease;
    if (!hasContent) continue;

    releases.push({
      version,
      date,
      prerelease,
      summary,
      sections,
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

export const GITHUB_REPO_BLOB_BASE =
  "https://github.com/Telemetry-Tracker/telemetry-tracker/blob/main";

/** Resolve markdown link targets from CHANGELOG (http, in-app, or repo-relative → GitHub). */
export function resolveChangelogLinkHref(href: string): {
  href: string;
  external: boolean;
} {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return { href, external: true };
  }
  if (href.startsWith("/")) {
    return { href, external: false };
  }
  const normalized = href.replace(/^\.\//, "");
  return {
    href: `${GITHUB_REPO_BLOB_BASE}/${normalized}`,
    external: true,
  };
}
