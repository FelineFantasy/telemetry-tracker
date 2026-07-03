import { describe, expect, it, afterEach } from "vitest";
import { getGoogleAnalyticsMeasurementId } from "./google-analytics";

describe("getGoogleAnalyticsMeasurementId", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("returns explicit env override", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
    expect(getGoogleAnalyticsMeasurementId()).toBe("G-TEST123");
  });

  it("returns hosted-cloud default in production when site URL matches", () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://telemetry-tracker.com";
    expect(getGoogleAnalyticsMeasurementId()).toBe("G-VL5GTNNCHH");
  });

  it("returns null for self-hosted production without env", () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://telemetry.example.com";
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.VERCEL_URL;
    expect(getGoogleAnalyticsMeasurementId()).toBeNull();
  });

  it("returns null in development without env", () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    process.env.NODE_ENV = "development";
    expect(getGoogleAnalyticsMeasurementId()).toBeNull();
  });
});
