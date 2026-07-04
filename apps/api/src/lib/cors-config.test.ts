import { afterEach, describe, expect, it } from "vitest";
import {
  buildDashboardCorsOptions,
  buildIngestCorsOptions,
  isIngestPath,
  parseDashboardCorsAllowlist,
  resolveCorsOptionsForRequest,
} from "./cors-config.js";

describe("cors-config", () => {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    DASHBOARD_ORIGIN: process.env.DASHBOARD_ORIGIN,
    TELEMETRY_DASHBOARD_ORIGIN: process.env.TELEMETRY_DASHBOARD_ORIGIN,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("isIngestPath matches ingest routes", () => {
    expect(isIngestPath("/ingest/event")).toBe(true);
    expect(isIngestPath("/ingest/batch?x=1")).toBe(true);
    expect(isIngestPath("/api/meta/projects")).toBe(false);
    expect(isIngestPath("/health")).toBe(false);
  });

  it("buildIngestCorsOptions reflects any origin without credentials", () => {
    expect(buildIngestCorsOptions()).toEqual({ origin: true, credentials: false });
  });

  it("parseDashboardCorsAllowlist falls back to TELEMETRY_DASHBOARD_ORIGIN", () => {
    delete process.env.CORS_ORIGINS;
    delete process.env.DASHBOARD_ORIGIN;
    process.env.TELEMETRY_DASHBOARD_ORIGIN = "https://telemetry-tracker.com";
    expect(parseDashboardCorsAllowlist()).toEqual(["https://telemetry-tracker.com"]);
  });

  it("resolveCorsOptionsForRequest uses ingest options on /ingest/*", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://dashboard.example.com";
    expect(resolveCorsOptionsForRequest({ url: "/ingest/event" })).toEqual({
      origin: true,
      credentials: false,
    });
  });

  it("resolveCorsOptionsForRequest uses dashboard allowlist on /api/*", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://dashboard.example.com";
    const opts = resolveCorsOptionsForRequest({ url: "/api/auth/me" });
    expect(opts.credentials).toBe(true);
    expect(typeof opts.origin).toBe("function");
  });

  it("buildDashboardCorsOptions rejects unknown origins in production", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://dashboard.example.com";
    const { origin } = buildDashboardCorsOptions();
    expect(typeof origin).toBe("function");

    const cb = (err: Error | null, allowed: boolean | string) => {
      expect(err).toBeNull();
      expect(allowed).toBe(false);
    };
    (origin as (o: string, cb: typeof cb) => void)(
      "https://customer-app.example.com",
      cb
    );
  });
});
