import { describe, expect, it } from "vitest";
import { changelogAnchor, parseChangelog } from "./changelog";

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
`;

describe("parseChangelog", () => {
  it("parses version sections and categories", () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases).toHaveLength(3);

    const unreleased = releases[0]!;
    expect(unreleased.version).toBe("Unreleased");
    expect(unreleased.prerelease).toBe(true);
    expect(unreleased.categories.Added).toEqual(["**Feature** — coming soon"]);

    const v140 = releases[1]!;
    expect(v140.version).toBe("1.4.0");
    expect(v140.date).toBe("2026-07-03");
    expect(v140.categories.Added?.[0]).toContain("Vue");
    expect(v140.categories.Changed?.[0]).toContain("Marketing");
  });

  it("builds markdown-compatible anchors", () => {
    expect(changelogAnchor("1.4.0", "2026-07-03")).toBe("1-4-0---2026-07-03");
  });
});
