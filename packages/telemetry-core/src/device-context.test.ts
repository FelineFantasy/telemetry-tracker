import { describe, expect, it } from "vitest";
import { readDeviceContext } from "./device-context.js";

describe("readDeviceContext", () => {
  it("parses Chrome on macOS from user agent", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: ua },
    });
    const ctx = readDeviceContext();
    expect(ctx.device_browser).toBe("Chrome");
    expect(ctx.device_os).toBe("macOS");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: original,
    });
  });
});
