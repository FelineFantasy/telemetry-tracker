import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_ALERT_SETTINGS,
  errorSpikeDedupeKey,
  parseProjectAlertSettings,
  validateProjectAlertSettingsPatch,
} from "./project-alert-settings.js";

describe("project-alert-settings", () => {
  it("returns defaults for invalid JSON", () => {
    expect(parseProjectAlertSettings(null)).toEqual(DEFAULT_PROJECT_ALERT_SETTINGS);
    expect(parseProjectAlertSettings({ errorSpike: {} })).toEqual(
      DEFAULT_PROJECT_ALERT_SETTINGS
    );
  });

  it("parses valid settings and fills email defaults", () => {
    const custom = {
      errorSpike: { enabled: false, threshold: 10, windowMinutes: 30 },
      quota: { enabled: true, nearPercent: 85 },
    };
    expect(parseProjectAlertSettings(custom)).toEqual({
      ...custom,
      email: DEFAULT_PROJECT_ALERT_SETTINGS.email,
    });
  });

  it("parses email recipient settings", () => {
    const custom = {
      errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
      quota: { enabled: true, nearPercent: 90 },
      email: {
        enabled: false,
        roles: ["OWNER", "VIEWER"],
        additionalEmails: ["Ops@Example.com", "ops@example.com", "oncall@ex.co"],
      },
    };
    expect(parseProjectAlertSettings(custom).email).toEqual({
      enabled: false,
      roles: ["OWNER", "VIEWER"],
      additionalEmails: ["ops@example.com", "oncall@ex.co"],
    });
  });

  it("rejects empty roles on patch", () => {
    const result = validateProjectAlertSettingsPatch({
      errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
      quota: { enabled: true, nearPercent: 90 },
      email: { enabled: true, roles: [], additionalEmails: [] },
    });
    expect(result.ok).toBe(false);
  });

  it("builds stable dedupe keys per window bucket", () => {
    const t = 1_700_000_000_000;
    const a = errorSpikeDedupeKey("proj-1", 15, t);
    const b = errorSpikeDedupeKey("proj-1", 15, t + 60_000);
    expect(a).toBe(b);
    expect(a).toContain("proj-1");
  });
});
