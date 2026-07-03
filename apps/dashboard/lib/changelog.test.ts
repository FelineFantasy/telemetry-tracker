import { describe, expect, it } from "vitest";
import {
  changelogAnchor,
  extractChangelogSummary,
  parseChangelog,
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

## [1.0.0] - 2026-06-26

First production-ready self-hosted release. See [docs/RELEASE.md](docs/RELEASE.md) for full notes.
`;

describe("parseChangelog", () => {
  it("parses version sections and categories", () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases).toHaveLength(4);

    const unreleased = releases[0]!;
    expect(unreleased.version).toBe("Unreleased");
    expect(unreleased.prerelease).toBe(true);
    expect(unreleased.categories.Added).toEqual(["**Feature** — coming soon"]);

    const v140 = releases[1]!;
    expect(v140.version).toBe("1.4.0");
    expect(v140.date).toBe("2026-07-03");
    expect(v140.categories.Added?.[0]).toContain("Vue");
    expect(v140.categories.Changed?.[0]).toContain("Marketing");

    const v100 = releases[3]!;
    expect(v100.version).toBe("1.0.0");
    expect(v100.summary[0]).toContain("First production-ready");
    expect(Object.keys(v100.categories)).toHaveLength(0);
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
