import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABS_PREFERENCES,
  parseLabsPreferences,
  validateLabsPreferencesPatch,
} from "./labs-preferences.js";

describe("labs-preferences", () => {
  it("returns defaults for invalid stored JSON", () => {
    expect(parseLabsPreferences(null)).toEqual(DEFAULT_LABS_PREFERENCES);
    expect(parseLabsPreferences({ commandPalette: "yes" })).toEqual(DEFAULT_LABS_PREFERENCES);
  });

  it("parses valid stored preferences", () => {
    expect(parseLabsPreferences({ commandPalette: true })).toEqual({ commandPalette: true });
  });

  it("validates PATCH payloads", () => {
    const valid = validateLabsPreferencesPatch({ commandPalette: true });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.preferences.commandPalette).toBe(true);
    }

    const invalid = validateLabsPreferencesPatch({ commandPalette: "on" });
    expect(invalid.ok).toBe(false);
  });
});
