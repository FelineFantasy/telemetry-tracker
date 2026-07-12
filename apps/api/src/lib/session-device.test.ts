import { describe, expect, it } from "vitest";
import { sessionDeviceFromUserAgent } from "./session-device.js";

describe("sessionDeviceFromUserAgent", () => {
  it("parses Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(sessionDeviceFromUserAgent(ua)).toEqual({
      userAgent: ua,
      deviceBrowser: "Chrome",
      deviceOs: "macOS",
    });
  });

  it("returns empty hints for missing user agent", () => {
    expect(sessionDeviceFromUserAgent(undefined)).toEqual({});
  });

  it("truncates long user agent strings", () => {
    const ua = "x".repeat(600);
    expect(sessionDeviceFromUserAgent(ua).userAgent).toHaveLength(512);
  });
});
