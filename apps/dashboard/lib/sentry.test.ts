import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureClientException,
  getClientSentryDsn,
  getServerSentryDsn,
  isClientSentryEnabled,
  isServerSentryEnabled,
} from "./sentry";

describe("sentry env gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("@/lib/product-telemetry");
  });

  it("returns undefined when DSN is unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(getServerSentryDsn()).toBeUndefined();
    expect(getClientSentryDsn()).toBeUndefined();
    expect(isServerSentryEnabled()).toBe(false);
    expect(isClientSentryEnabled()).toBe(false);
  });

  it("trims DSN values outside test mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SENTRY_DSN", "  https://example@sentry.io/1  ");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "  https://example@sentry.io/1  ");
    expect(getServerSentryDsn()).toBe("https://example@sentry.io/1");
    expect(getClientSentryDsn()).toBe("https://example@sentry.io/1");
  });

  it("skips all runtimes in test mode", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SENTRY_DSN", "https://example@sentry.io/1");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example@sentry.io/1");
    expect(getServerSentryDsn()).toBeUndefined();
    expect(getClientSentryDsn()).toBeUndefined();
  });

  it("captureClientException is a no-op without client DSN", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(() => captureClientException(new Error("test"))).not.toThrow();
  });

  it("captureClientException tolerates window teardown during async product-telemetry import", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    const shouldTrack = vi.fn(() => {
      throw new Error("shouldTrackProductTelemetry must not run without window");
    });

    vi.resetModules();
    vi.doMock("@/lib/product-telemetry", async () => {
      await new Promise((r) => setTimeout(r, 25));
      return { shouldTrackProductTelemetry: shouldTrack };
    });

    const { captureClientException: capture } = await import("./sentry");
    expect(typeof window).not.toBe("undefined");
    expect(() => capture(new Error("teardown-race"))).not.toThrow();

    // Simulate jsdom teardown between sync return and dynamic-import resolution.
    vi.stubGlobal("window", undefined as unknown as Window & typeof globalThis);

    await new Promise((r) => setTimeout(r, 50));
    expect(shouldTrack).not.toHaveBeenCalled();
  });
});
