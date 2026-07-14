import { describe, expect, it } from "vitest";
import {
  appendReleaseEmailFooter,
  buildReleaseEmailBodyHtml,
  changelogMarkdownToHtml,
  parseInlineMarkdown,
} from "./release-email-template.js";

describe("parseInlineMarkdown", () => {
  it("renders bold without literal asterisks", () => {
    expect(parseInlineMarkdown("**Analytics lists** — faster tables")).toContain(
      "<strong"
    );
    expect(parseInlineMarkdown("**Analytics lists** — faster tables")).not.toContain("**");
  });

  it("renders markdown links", () => {
    const html = parseInlineMarkdown("See [#418](https://github.com/example/issues/418)");
    expect(html).toContain('href="https://github.com/example/issues/418"');
    expect(html).toContain("#418");
  });
});

describe("changelogMarkdownToHtml", () => {
  it("groups list items and section headings", () => {
    const html = changelogMarkdownToHtml(`### Added

- **Feature A** — detail
- **Feature B** — detail`);
    expect(html).toContain("Added");
    expect(html).toContain("<ul");
    expect(html).toContain("Feature A");
    expect(html).not.toContain("**Feature");
  });
});

describe("buildReleaseEmailBodyHtml", () => {
  it("includes branded shell and CTA buttons", () => {
    const html = buildReleaseEmailBodyHtml({
      version: "1.9.0",
      sectionMarkdown: "### Added\n\n- **Lists** — sort client-side",
      dashboardOrigin: "https://telemetry-tracker.com",
    });
    expect(html).toContain("Telemetry");
    expect(html).toContain("Tracker");
    expect(html).toContain("v1.9.0");
    expect(html).toContain("Release notes");
    expect(html).toContain("Open dashboard");
    expect(html).toContain("telemetry-logo.jpg");
  });
});

describe("appendReleaseEmailFooter", () => {
  it("adds unsubscribe link", () => {
    const html = appendReleaseEmailFooter(
      buildReleaseEmailBodyHtml({
        version: "1.9.0",
        sectionMarkdown: "### Added\n\n- Item",
        dashboardOrigin: "https://telemetry-tracker.com",
      }),
      "https://telemetry-tracker.com/unsubscribe?token=abc"
    );
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("token=abc");
  });
});
