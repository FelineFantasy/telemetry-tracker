import { describe, expect, it } from "vitest";
import {
  changelogAnchor,
  extractChangelogSummary,
  parseChangelog,
  parseCustomSectionBody,
  resolveChangelogLinkHref,
} from "./changelog";

const SAMPLE = `# Changelog

## [Unreleased]

### Added

- **Feature** — coming soon

---

## [1.4.0] - 2026-07-03

### Added

- **Docs** — Vue guides

### Changed

- **Marketing** — SDK tabs

---

## [1.3.4] - 2026-07-03

### Fixed

- **Billing CTAs** — hide Pro upgrade when on Pro

---

## [1.3.0] - 2026-07-02

### Added

- **Source maps v1** — upload and symbolication

### Database

After upgrading from v1.2.x, run:

\`\`\`bash
pnpm --filter api exec prisma migrate deploy
\`\`\`

New migrations in this release:

- \`20260703120000_error_release\` — release column
- \`20260703130000_source_map_artifacts\` — source map storage

---

## [1.2.0] - 2026-07-01

### Added

- **Alerting v1** — spike rules

### SDK compatibility

- Platform v1.2.x works with \`@telemetry-tracker/*\` **>= 1.2.0**

---

## [1.0.0] - 2026-06-26

First production-ready self-hosted release. See [docs/RELEASE.md](docs/RELEASE.md) for full notes.
`;

describe("parseChangelog", () => {
  it("parses version sections and categories", () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases).toHaveLength(6);

    const unreleased = releases[0]!;
    expect(unreleased.version).toBe("Unreleased");
    expect(unreleased.prerelease).toBe(true);
    expect(unreleased.sections[0]).toEqual({
      kind: "category",
      category: "Added",
      items: ["**Feature** — coming soon"],
    });

    const v140 = releases[1]!;
    expect(v140.version).toBe("1.4.0");
    expect(v140.date).toBe("2026-07-03");
    expect(v140.sections[0]?.kind).toBe("category");
    if (v140.sections[0]?.kind === "category") {
      expect(v140.sections[0].items[0]).toContain("Vue");
    }

    const v100 = releases[5]!;
    expect(v100.version).toBe("1.0.0");
    expect(v100.summary[0]).toContain("First production-ready");
    expect(v100.sections).toHaveLength(0);
  });

  it("parses Database sections with prose, code, and migration lists", () => {
    const v130 = parseChangelog(SAMPLE).find((r) => r.version === "1.3.0")!;
    const database = v130.sections.find((s) => s.kind === "custom" && s.title === "Database");
    expect(database?.kind).toBe("custom");
    if (database?.kind !== "custom") return;

    expect(database.blocks[0]).toEqual({
      type: "paragraph",
      text: "After upgrading from v1.2.x, run:",
    });
    expect(database.blocks[1]).toEqual({
      type: "code",
      language: "bash",
      code: "pnpm --filter api exec prisma migrate deploy",
    });
    expect(database.blocks[2]).toEqual({
      type: "paragraph",
      text: "New migrations in this release:",
    });
    expect(database.blocks[3]).toEqual({
      type: "list",
      items: [
        "`20260703120000_error_release` — release column",
        "`20260703130000_source_map_artifacts` — source map storage",
      ],
    });
  });

  it("parses SDK compatibility sections", () => {
    const v120 = parseChangelog(SAMPLE).find((r) => r.version === "1.2.0")!;
    const sdk = v120.sections.find((s) => s.kind === "custom" && s.title === "SDK compatibility");
    expect(sdk?.kind).toBe("custom");
    if (sdk?.kind !== "custom") return;

    expect(sdk.blocks).toEqual([
      {
        type: "list",
        items: ["Platform v1.2.x works with `@telemetry-tracker/*` **>= 1.2.0**"],
      },
    ]);
  });

  it("preserves section order (categories before custom sections)", () => {
    const v130 = parseChangelog(SAMPLE).find((r) => r.version === "1.3.0")!;
    expect(v130.sections.map((s) => (s.kind === "category" ? s.category : s.title))).toEqual([
      "Added",
      "Database",
    ]);
  });

  it("extracts prose before category headings", () => {
    const block = `## [1.0.0] - 2026-06-26

Intro paragraph.

### Added

- **Item** — detail
`;
    expect(extractChangelogSummary(block)).toEqual(["Intro paragraph."]);
  });

  it("builds markdown-compatible anchors", () => {
    expect(changelogAnchor("1.4.0", "2026-07-03")).toBe("1-4-0---2026-07-03");
  });

  it("resolves changelog link targets", () => {
    expect(resolveChangelogLinkHref("https://telemetry-tracker.com")).toEqual({
      href: "https://telemetry-tracker.com",
      external: true,
    });
    expect(resolveChangelogLinkHref("/docs/hosted-cloud")).toEqual({
      href: "/docs/hosted-cloud",
      external: false,
    });
    expect(resolveChangelogLinkHref("docs/RELEASE.md#v100-2026-06-26")).toEqual({
      href: "https://github.com/Telemetry-Tracker/telemetry-tracker/blob/main/docs/RELEASE.md#v100-2026-06-26",
      external: true,
    });
  });
});

describe("parseCustomSectionBody", () => {
  it("handles mixed prose, code, and lists", () => {
    const body = `After upgrading, run:

\`\`\`bash
pnpm migrate deploy
\`\`\`

New migrations:

- \`abc\` — first
`;
    expect(parseCustomSectionBody(body)).toEqual([
      { type: "paragraph", text: "After upgrading, run:" },
      { type: "code", language: "bash", code: "pnpm migrate deploy" },
      { type: "paragraph", text: "New migrations:" },
      { type: "list", items: ["`abc` — first"] },
    ]);
  });
});
