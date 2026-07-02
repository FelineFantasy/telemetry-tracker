import { describe, expect, it, vi } from "vitest";
import { MAX_SOURCE_MAP_BUNDLES_PER_RELEASE } from "./source-map-artifact.js";
import {
  enrichErrorGroupWithSymbolicatedStacks,
  findMatchingArtifact,
  firstSymbolicatedFrameLine,
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

  it("does not match different pathnames on the same host", () => {
    expect(
      frameMatchesBundle(
        "https://cdn.example.com/prefix/app.js",
        "https://cdn.example.com/app.js"
      )
    ).toBe(false);
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

describe("firstSymbolicatedFrameLine", () => {
  it("skips the error message line and symbolicates the first frame", () => {
    const stack = [
      "TypeError: boom",
      "    at main (https://cdn.example.com/bundle.js:1:0)",
    ].join("\n");
    const artifacts = [{ bundle_url: "https://cdn.example.com/bundle.js", content: minimalMap }];
    const line = firstSymbolicatedFrameLine(stack, artifacts);
    expect(line).toContain("src/index.ts");
  });
});

describe("enrichErrorGroupWithSymbolicatedStacks", () => {
  it("loads bundle refs once per release and fetches content only for matching frames", async () => {
    const findMany = vi.fn(async () => [
      { id: "map-1", bundle_url: "https://cdn.example.com/bundle.js" },
    ]);
    const findUnique = vi.fn(async () => ({
      bundle_url: "https://cdn.example.com/bundle.js",
      content: minimalMap,
    }));
    const prisma = {
      sourceMapArtifact: { findMany, findUnique },
    };
    const stack = [
      "Error: boom",
      "    at main (https://cdn.example.com/bundle.js:1:0)",
    ].join("\n");
    const group = {
      app: "web",
      release: "1.0.0",
      top_stack: "Error: boom",
      occurrences_list: Array.from({ length: 5 }, (_, i) => ({
        id: `occ-${i}`,
        stack,
        release: "1.0.0",
      })),
    };

    const enriched = await enrichErrorGroupWithSymbolicatedStacks(
      prisma as never,
      "project-1",
      group
    );

    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith({
      where: { project_id: "project-1", app: "web", release: "1.0.0" },
      select: { id: true, bundle_url: true },
      orderBy: { uploaded_at: "desc" },
      take: MAX_SOURCE_MAP_BUNDLES_PER_RELEASE,
    });
    expect(findUnique).toHaveBeenCalledOnce();
    expect(enriched.symbolicated_top_stack).toContain("src/index.ts");
    expect(enriched.occurrences_list[0]?.symbolicated_stack).toContain("src/index.ts");
    expect(enriched.occurrences_list[0]?.symbolication_status).toBe("symbolicated");
  });

  it("normalizes legacy padded app labels when loading maps", async () => {
    const findMany = vi.fn(async () => []);
    const prisma = {
      sourceMapArtifact: { findMany, findUnique: vi.fn() },
    };
    const stack = "    at main (https://cdn.example.com/bundle.js:1:0)";
    const group = {
      app: "  web  ",
      release: " 1.0.0 ",
      occurrences_list: [{ id: "occ-1", stack, release: " 1.0.0 " }],
    };

    await enrichErrorGroupWithSymbolicatedStacks(prisma as never, "project-1", group);

    expect(findMany).toHaveBeenCalledWith({
      where: { project_id: "project-1", app: "web", release: "1.0.0" },
      select: { id: true, bundle_url: true },
      orderBy: { uploaded_at: "desc" },
      take: MAX_SOURCE_MAP_BUNDLES_PER_RELEASE,
    });
  });

  it("derives symbolicated_top_stack only from the newest occurrence", async () => {
    const findMany = vi.fn(async () => [
      { id: "map-1", bundle_url: "https://cdn.example.com/bundle.js" },
    ]);
    const findUnique = vi.fn(async () => ({
      bundle_url: "https://cdn.example.com/bundle.js",
      content: minimalMap,
    }));
    const prisma = {
      sourceMapArtifact: { findMany, findUnique },
    };
    const group = {
      app: "web",
      release: "1.0.0",
      occurrences_list: [
        {
          id: "occ-new",
          stack: "Error: no map\n    at x (https://other.example/other.js:1:0)",
          release: "1.0.0",
        },
        {
          id: "occ-old",
          stack: "    at main (https://cdn.example.com/bundle.js:1:0)",
          release: "1.0.0",
        },
      ],
    };

    const enriched = await enrichErrorGroupWithSymbolicatedStacks(
      prisma as never,
      "project-1",
      group
    );

    expect(enriched.symbolicated_top_stack).toBeUndefined();
    expect(enriched.occurrences_list[1]?.symbolicated_stack).toContain("src/index.ts");
    expect(enriched.occurrences_list[1]?.symbolication_status).toBe("symbolicated");
    expect(enriched.occurrences_list[0]?.symbolicated_stack).toBeUndefined();
    expect(enriched.occurrences_list[0]?.symbolication_status).toBe("no_match");
  });

  it("marks occurrences as no_maps when nothing is uploaded for the release", async () => {
    const findMany = vi.fn(async () => []);
    const prisma = {
      sourceMapArtifact: { findMany, findUnique: vi.fn() },
    };
    const stack = "    at main (https://cdn.example.com/bundle.js:1:0)";
    const group = {
      app: "web",
      release: "1.0.0",
      occurrences_list: [{ id: "occ-1", stack, release: "1.0.0" }],
    };

    const enriched = await enrichErrorGroupWithSymbolicatedStacks(
      prisma as never,
      "project-1",
      group
    );

    expect(enriched.occurrences_list[0]?.symbolication_status).toBe("no_maps");
    expect(enriched.occurrences_list[0]?.symbolicated_stack).toBeUndefined();
  });

  it("marks occurrences as no_match when maps exist but frames do not match", async () => {
    const findMany = vi.fn(async () => [
      { id: "map-1", bundle_url: "https://cdn.example.com/bundle.js" },
    ]);
    const findUnique = vi.fn(async () => ({
      bundle_url: "https://cdn.example.com/bundle.js",
      content: minimalMap,
    }));
    const prisma = {
      sourceMapArtifact: { findMany, findUnique },
    };
    const stack = "    at main (https://other.example/other.js:1:0)";
    const group = {
      app: "web",
      release: "1.0.0",
      occurrences_list: [{ id: "occ-1", stack, release: "1.0.0" }],
    };

    const enriched = await enrichErrorGroupWithSymbolicatedStacks(
      prisma as never,
      "project-1",
      group
    );

    expect(enriched.occurrences_list[0]?.symbolication_status).toBe("no_match");
    expect(enriched.occurrences_list[0]?.symbolicated_stack).toBeUndefined();
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
