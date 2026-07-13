import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABS_PREFERENCES,
  parseLabsPreferences,
} from "./labs-preferences-shared";

describe("labs-preferences-shared", () => {
  it("returns defaults for invalid stored JSON", () => {
    expect(parseLabsPreferences(null)).toEqual(DEFAULT_LABS_PREFERENCES);
    expect(parseLabsPreferences({ commandPalette: "yes" })).toEqual(DEFAULT_LABS_PREFERENCES);
  });

  it("parses valid stored preferences", () => {
    expect(parseLabsPreferences({ commandPalette: true })).toEqual({ commandPalette: true });
  });
});
