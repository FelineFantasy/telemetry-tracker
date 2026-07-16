import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  init,
  shutdown,
  trackEvent,
  trackError,
  resolveClientPiiScrub,
} from "./index.js";
import { scrubPiiRecord, scrubPiiText } from "./pii-scrub.js";

describe("resolveClientPiiScrub", () => {
  it("is off when omitted or false", () => {
    expect(resolveClientPiiScrub(null)).toBeNull();
    expect(
      resolveClientPiiScrub({
        ingestUrl: "http://x",
        app: "a",
      })
    ).toBeNull();
    expect(
      resolveClientPiiScrub({
        ingestUrl: "http://x",
        app: "a",
        piiScrub: false,
      })
    ).toBeNull();
  });

  it("enables defaults for true and empty denyKeys object", () => {
    expect(
      resolveClientPiiScrub({
        ingestUrl: "http://x",
        app: "a",
        piiScrub: true,
      })
    ).toEqual({});
    expect(
      resolveClientPiiScrub({
        ingestUrl: "http://x",
        app: "a",
        piiScrub: { denyKeys: [] },
      })
    ).toEqual({});
  });

  it("passes through denyKeys when provided", () => {
    expect(
      resolveClientPiiScrub({
        ingestUrl: "http://x",
        app: "a",
        piiScrub: { denyKeys: ["NationalId"] },
      })
    ).toEqual({ denyKeys: ["NationalId"] });
  });
});

describe("client scrubbing does not mutate caller objects", () => {
  it("returns new records for properties", () => {
    const props = { email: "a@b.co", nested: { phone: "1" } };
    const out = scrubPiiRecord(props)!;
    expect(out).not.toBe(props);
    expect(out.nested).not.toBe(props.nested);
    expect(props.email).toBe("a@b.co");
  });
});

describe("stable placeholders survive double scrubbing", () => {
  it("does not corrupt [email] / [token] / [redacted]", () => {
    const once = scrubPiiText("mail user@example.com token=secret");
    expect(once).toContain("[email]");
    expect(scrubPiiText(once)).toBe(once);
    expect(scrubPiiText("already [email] and [token] and x=[redacted]")).toBe(
      "already [email] and [token] and x=[redacted]"
    );
  });
});

describe("trackEvent / trackError with piiScrub", () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });

  function bodyFromPath(pathPart: string): Record<string, unknown> {
    const call = fetchMock.mock.calls.find(([url]) =>
      String(url).includes(pathPart)
    );
    expect(call).toBeTruthy();
    const opts = call![1] as RequestInit;
    return JSON.parse(String(opts.body)) as Record<string, unknown>;
  }

  beforeEach(async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => {
    shutdown();
    vi.unstubAllGlobals();
  });

  it("does not scrub when piiScrub is omitted", async () => {
    init({
      ingestUrl: "http://localhost:3001",
      app: "test-app",
      apiKey: "tt_live_pub_secret",
      batchInterval: 0,
    });
    fetchMock.mockClear();
    const props = { email: "user@example.com" };
    trackEvent("e", props);
    await new Promise((r) => setTimeout(r, 10));
    expect(props.email).toBe("user@example.com");
    const body = bodyFromPath("/ingest/event") as {
      properties: { email: string };
    };
    expect(body.properties.email).toBe("user@example.com");
  });

  it("scrubs event properties before the network request", async () => {
    init({
      ingestUrl: "http://localhost:3001",
      app: "test-app",
      apiKey: "tt_live_pub_secret",
      batchInterval: 0,
      piiScrub: { denyKeys: ["nationalId"] },
    });
    fetchMock.mockClear();
    const props = {
      email: "user@example.com",
      nationalId: "X-1",
      nested: { ok: true, note: "Bearer abc.def" },
    };
    trackEvent("e", props);
    await new Promise((r) => setTimeout(r, 10));
    expect(props.email).toBe("user@example.com");
    expect(props.nationalId).toBe("X-1");
    const body = bodyFromPath("/ingest/event") as {
      properties: {
        email: string;
        nationalId: string;
        nested: { note: string };
      };
    };
    expect(body.properties.email).toBe("[email]");
    expect(body.properties.nationalId).toBe("[redacted]");
    expect(body.properties.nested.note).toBe("[bearer-token]");
  });

  it("scrubs error message/stack/context before send", async () => {
    init({
      ingestUrl: "http://localhost:3001",
      app: "test-app",
      apiKey: "tt_live_pub_secret",
      batchInterval: 0,
      piiScrub: true,
    });
    fetchMock.mockClear();
    const ctx = { email: "a@b.co" };
    trackError(new Error("boom user@x.io"), ctx);
    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.email).toBe("a@b.co");
    const body = bodyFromPath("/ingest/error") as {
      message: string;
      context: { email: string };
    };
    expect(body.message).toContain("[email]");
    expect(body.context.email).toBe("[email]");
  });
});
