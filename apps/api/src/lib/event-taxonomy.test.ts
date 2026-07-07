import { describe, expect, it } from "vitest";
import { parseEventCaptureKind } from "./event-taxonomy.js";

describe("parseEventCaptureKind", () => {
  it("marks $-prefixed SDK names as auto-captured", () => {
    expect(parseEventCaptureKind("$screen")).toBe("auto");
    expect(parseEventCaptureKind("$request")).toBe("auto");
    expect(parseEventCaptureKind("$click")).toBe("auto");
  });

  it("marks other names as custom", () => {
    expect(parseEventCaptureKind("user_registered")).toBe("custom");
    expect(parseEventCaptureKind("screen_view")).toBe("custom");
    expect(parseEventCaptureKind("")).toBe("custom");
  });

  it("trims whitespace before checking prefix", () => {
    expect(parseEventCaptureKind("  $screen  ")).toBe("auto");
  });
});
