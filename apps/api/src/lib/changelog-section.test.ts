import { describe, expect, it } from "vitest";
import {
  extractChangelogMinorLineFromContent,
  extractChangelogSectionFromContent,
} from "./changelog-section.js";

const SAMPLE = `# Changelog

## [Unreleased]

---

## [1.8.1] - 2026-07-13

### Fixed

- **Hotfix** — list load

---

## [1.8.0] - 2026-07-12

### Added

- **Profile settings** — save display name

### Changed

- **Settings hub** — real changelog

---

## [1.7.4] - 2026-07-12

### Added

- Monitoring
`;

describe("extractChangelogSectionFromContent", () => {
  it("extracts a dated semver section without the date line in body", () => {
    const section = extractChangelogSectionFromContent(SAMPLE, "1.8.0");
    expect(section).toContain("### Added");
    expect(section).toContain("Profile settings");
    expect(section).not.toMatch(/^-\s*2026-/);
  });

  it("returns null when section is missing", () => {
    expect(extractChangelogSectionFromContent(SAMPLE, "9.9.9")).toBeNull();
  });

  it("returns null for empty Unreleased section", () => {
    expect(extractChangelogSectionFromContent(SAMPLE, "Unreleased")).toBeNull();
  });
});

describe("extractChangelogMinorLineFromContent", () => {
  it("concatenates all sections for the minor line in ascending order", () => {
    const line = extractChangelogMinorLineFromContent(SAMPLE, {
      closingVersion: "1.8.1",
      previousVersion: "1.7.4",
    });
    expect(line).not.toBeNull();
    expect(line!.lineLabel).toBe("1.8");
    expect(line!.versions).toEqual(["1.8.0", "1.8.1"]);
    expect(line!.sectionMarkdown).toContain("### 1.8.0");
    expect(line!.sectionMarkdown).toContain("### 1.8.1");
    expect(line!.sectionMarkdown).toContain("Profile settings");
    expect(line!.sectionMarkdown).toContain("Hotfix");
    expect(line!.sectionMarkdown).not.toContain("Monitoring");
  });

  it("excludes versions at or before previousVersion within the same line", () => {
    const line = extractChangelogMinorLineFromContent(SAMPLE, {
      closingVersion: "1.8.1",
      previousVersion: "1.8.0",
    });
    expect(line!.versions).toEqual(["1.8.1"]);
    expect(line!.sectionMarkdown).not.toContain("Profile settings");
  });

  it("returns null when no matching sections exist", () => {
    expect(
      extractChangelogMinorLineFromContent(SAMPLE, {
        closingVersion: "9.9.0",
        previousVersion: "9.8.0",
      })
    ).toBeNull();
  });
});
