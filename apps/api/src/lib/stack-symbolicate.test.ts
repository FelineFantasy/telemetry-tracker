import { describe, expect, it } from "vitest";
import {
  findMatchingArtifact,
  frameMatchesBundle,
  parseStackFrame,
  symbolicateStackTrace,
} from "./stack-symbolicate.js";

const minimalMap = JSON.stringify({
  version: 3,
  file: "bundle.js",
  sources: ["src/index.ts"],
  names: ["main"],
  mappings: "AAAA,SAASA",
});

describe("parseStackFrame", () => {
  it("parses V8 frames with function names", () => {
    const frame = parseStackFrame("    at main (https://cdn.example.com/bundle.js:1:0)");
    expect(frame.file).toBe("https://cdn.example.com/bundle.js");
    expect(frame.line).toBe(1);
    expect(frame.column).toBe(0);
    expect(frame.functionName).toBe("main");
  });

  it("parses Firefox-style frames", () => {
    const frame = parseStackFrame("main@https://cdn.example.com/bundle.js:2:4");
    expect(frame.file).toBe("https://cdn.example.com/bundle.js");
    expect(frame.functionName).toBe("main");
  });
});

describe("frameMatchesBundle", () => {
  it("matches identical full URLs", () => {
    expect(
      frameMatchesBundle(
        "https://cdn.example.com/assets/app.js",
        "https://cdn.example.com/assets/app.js"
      )
    ).toBe(true);
  });

  it("matches relative frame filenames against full bundle URLs", () => {
    expect(frameMatchesBundle("app.js", "https://cdn.example.com/assets/app.js")).toBe(true);
  });

  it("does not match different hosts by basename alone", () => {
    expect(
      frameMatchesBundle(
        "https://other.example/bundle.js",
        "https://cdn.example.com/bundle.js"
      )
    ).toBe(false);
  });
});

describe("symbolicateStackTrace", () => {
  it("rewrites matching frames using uploaded maps", () => {
    const stack = [
      "Error: boom",
      "    at main (https://cdn.example.com/bundle.js:1:0)",
    ].join("\n");
    const artifacts = [
      { bundle_url: "https://cdn.example.com/bundle.js", content: minimalMap },
    ];
    const result = symbolicateStackTrace(stack, artifacts);
    expect(result).not.toBe(stack);
    expect(result).toContain("src/index.ts");
  });

  it("returns the original stack when no artifact matches", () => {
    const stack = "    at main (https://other.example/bundle.js:1:0)";
    const result = symbolicateStackTrace(stack, [
      { bundle_url: "https://cdn.example.com/bundle.js", content: minimalMap },
    ]);
    expect(result).toBe(stack);
  });
});

describe("findMatchingArtifact", () => {
  it("selects the artifact whose bundle URL matches the frame file", () => {
    const artifacts = [
      { bundle_url: "https://cdn.example.com/a.js", content: "{}" },
      { bundle_url: "https://cdn.example.com/b.js", content: minimalMap },
    ];
    expect(findMatchingArtifact("b.js", artifacts)?.bundle_url).toContain("/b.js");
  });
});
