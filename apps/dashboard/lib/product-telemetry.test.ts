import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRODUCT_TELEMETRY_APP,
  getProductTelemetryConfig,
  isProductTelemetryEnabled,
  isProductTelemetryPath,
  shouldTrackProductTelemetry,
} from "./product-telemetry";

describe("product telemetry env gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when ingest URL or API key is unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_INGEST_URL", "");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_API_KEY", "");
    expect(getProductTelemetryConfig()).toBeNull();
    expect(isProductTelemetryEnabled()).toBe(false);
  });

  it("builds config when ingest URL and API key are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_INGEST_URL", " https://api.telemetry-tracker.com/ ");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_API_KEY", " tt_live_test ");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_APP", "");
    expect(getProductTelemetryConfig()).toEqual({
      ingestUrl: "https://api.telemetry-tracker.com",
      apiKey: "tt_live_test",
      app: DEFAULT_PRODUCT_TELEMETRY_APP,
      environment: "production",
    });
  });

  it("skips in test mode even when env is set", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_INGEST_URL", "https://api.telemetry-tracker.com");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_API_KEY", "tt_live_test");
    expect(getProductTelemetryConfig()).toBeNull();
  });

  it("only tracks dashboard paths when enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_INGEST_URL", "https://api.telemetry-tracker.com");
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_API_KEY", "tt_live_test");

    expect(isProductTelemetryPath(null)).toBe(false);
    expect(isProductTelemetryPath("/")).toBe(false);
    expect(isProductTelemetryPath("/docs/nextjs")).toBe(false);
    expect(isProductTelemetryPath("/dashboard")).toBe(true);
    expect(isProductTelemetryPath("/dashboard/overview")).toBe(true);

    expect(shouldTrackProductTelemetry("/")).toBe(false);
    expect(shouldTrackProductTelemetry("/dashboard")).toBe(true);
  });
});
