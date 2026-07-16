import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_PII_SCRUB_SETTINGS,
  formatPiiScrubSettingsAuditTarget,
  parseProjectPiiScrubSettings,
  validateProjectPiiScrubSettingsPatch,
} from "./project-pii-scrub-settings.js";

describe("parseProjectPiiScrubSettings", () => {
  it("defaults empty denyKeys and scrubSessionUserEmail false", () => {
    expect(parseProjectPiiScrubSettings(null)).toEqual(
      DEFAULT_PROJECT_PII_SCRUB_SETTINGS
    );
    expect(parseProjectPiiScrubSettings({ denyKeys: ["x"] })).toEqual({
      denyKeys: ["x"],
      scrubSessionUserEmail: false,
    });
  });

  it("dedupes and trims deny keys", () => {
    expect(
      parseProjectPiiScrubSettings({
        denyKeys: [" customerId ", "customer_id", "CustomerId", "ok"],
        scrubSessionUserEmail: true,
      })
    ).toEqual({ denyKeys: ["customerId", "ok"], scrubSessionUserEmail: true });
  });
});

describe("validateProjectPiiScrubSettingsPatch", () => {
  it("accepts a valid full patch", () => {
    const result = validateProjectPiiScrubSettingsPatch({
      denyKeys: ["ssn", "nationalId"],
      scrubSessionUserEmail: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settings).toEqual({
        denyKeys: ["ssn", "nationalId"],
        scrubSessionUserEmail: true,
      });
    }
  });

  it("merges partial patches without wiping omitted fields", () => {
    const previous = {
      denyKeys: ["keepMe"],
      scrubSessionUserEmail: true,
    };
    const denyOnly = validateProjectPiiScrubSettingsPatch(
      { denyKeys: ["newKey"] },
      previous
    );
    expect(denyOnly.ok).toBe(true);
    if (denyOnly.ok) {
      expect(denyOnly.settings).toEqual({
        denyKeys: ["newKey"],
        scrubSessionUserEmail: true,
      });
    }
    const flagOnly = validateProjectPiiScrubSettingsPatch(
      { scrubSessionUserEmail: false },
      previous
    );
    expect(flagOnly.ok).toBe(true);
    if (flagOnly.ok) {
      expect(flagOnly.settings).toEqual({
        denyKeys: ["keepMe"],
        scrubSessionUserEmail: false,
      });
    }
  });

  it("rejects empty patches and oversized deny lists", () => {
    expect(validateProjectPiiScrubSettingsPatch({}).ok).toBe(false);
    const result = validateProjectPiiScrubSettingsPatch({
      denyKeys: Array.from({ length: 51 }, (_, i) => `k${i}`),
    });
    expect(result.ok).toBe(false);
  });
});

describe("formatPiiScrubSettingsAuditTarget", () => {
  it("logs counts only", () => {
    expect(
      formatPiiScrubSettingsAuditTarget("proj-1", {
        denyKeys: ["a", "b"],
        scrubSessionUserEmail: true,
      })
    ).toBe("project:proj-1 denyKeys=2 scrubSessionUserEmail=true");
  });
});
