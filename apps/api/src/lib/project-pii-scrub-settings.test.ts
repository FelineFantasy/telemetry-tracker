import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_PII_SCRUB_SETTINGS,
  parseProjectPiiScrubSettings,
  validateProjectPiiScrubSettingsPatch,
} from "./project-pii-scrub-settings.js";

describe("parseProjectPiiScrubSettings", () => {
  it("defaults empty denyKeys", () => {
    expect(parseProjectPiiScrubSettings(null)).toEqual(
      DEFAULT_PROJECT_PII_SCRUB_SETTINGS
    );
  });

  it("dedupes and trims deny keys", () => {
    expect(
      parseProjectPiiScrubSettings({
        denyKeys: [" customerId ", "customer_id", "CustomerId", "ok"],
      })
    ).toEqual({ denyKeys: ["customerId", "ok"] });
  });
});

describe("validateProjectPiiScrubSettingsPatch", () => {
  it("accepts a valid patch", () => {
    const result = validateProjectPiiScrubSettingsPatch({
      denyKeys: ["ssn", "nationalId"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settings.denyKeys).toEqual(["ssn", "nationalId"]);
    }
  });

  it("rejects oversized deny lists", () => {
    const result = validateProjectPiiScrubSettingsPatch({
      denyKeys: Array.from({ length: 51 }, (_, i) => `k${i}`),
    });
    expect(result.ok).toBe(false);
  });
});
