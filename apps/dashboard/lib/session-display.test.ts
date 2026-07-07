import { describe, expect, it } from "vitest";
import { countryFlagEmoji, formatSessionDevice } from "./session-display";

describe("countryFlagEmoji", () => {
  it("returns flag emoji for valid ISO codes", () => {
    expect(countryFlagEmoji("us")).toBe("🇺🇸");
    expect(countryFlagEmoji("DE")).toBe("🇩🇪");
  });

  it("returns null for invalid codes", () => {
    expect(countryFlagEmoji("")).toBeNull();
    expect(countryFlagEmoji("USA")).toBeNull();
  });
});

describe("formatSessionDevice", () => {
  it("joins browser and OS with a middle dot", () => {
    expect(formatSessionDevice("Chrome", "macOS")).toBe("Chrome · macOS");
  });

  it("returns null when both are empty", () => {
    expect(formatSessionDevice(null, null)).toBeNull();
  });
});
