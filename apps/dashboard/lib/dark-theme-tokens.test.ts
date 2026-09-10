import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("dark theme tokens", () => {
  it("uses a dark navy canvas with charcoal cards, not near-black 0.04", () => {
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).not.toContain("--background: oklch(0.04 0 0)");
    expect(css).toContain("--background: oklch(0.14 0.018 260)");
    expect(css).toContain("--border: oklch(1 0 0 / 18%)");
  });
});

describe("dashboard navigation", () => {
  it("does not paint a full-screen overlay on route changes", () => {
    const src = readFileSync(join(root, "lib/use-dashboard-navigation.tsx"), "utf8");
    expect(src).not.toContain("backdrop-blur-md");
    expect(src).not.toContain("fixed inset-0");
    expect(src).toContain("DashboardNavigationProgress");
  });
});
