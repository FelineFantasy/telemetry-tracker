import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_ALERT_SETTINGS,
  errorSpikeDedupeKey,
  parseProjectAlertSettings,
} from "./project-alert-settings.js";

describe("project-alert-settings", () => {
  it("returns defaults for invalid JSON", () => {
    expect(parseProjectAlertSettings(null)).toEqual(DEFAULT_PROJECT_ALERT_SETTINGS);
    expect(parseProjectAlertSettings({ errorSpike: {} })).toEqual(
      DEFAULT_PROJECT_ALERT_SETTINGS
    );
  });

  it("parses valid settings", () => {
    const custom = {
      errorSpike: { enabled: false, threshold: 10, windowMinutes: 30 },
      quota: { enabled: true, nearPercent: 85 },
    };
    expect(parseProjectAlertSettings(custom)).toEqual(custom);
  });

  it("builds stable dedupe keys per window bucket", () => {
    const t = 1_700_000_000_000;
    const a = errorSpikeDedupeKey("proj-1", 15, t);
    const b = errorSpikeDedupeKey("proj-1", 15, t + 60_000);
    expect(a).toBe(b);
    expect(a).toContain("proj-1");
  });
});
