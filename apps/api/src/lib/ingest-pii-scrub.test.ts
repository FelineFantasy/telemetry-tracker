import { afterEach, describe, expect, it } from "vitest";
import { computeFingerprint } from "../services/errors.js";
import {
  isIngestPiiScrubEnabled,
  resolveIngestPiiScrubOptions,
  scrubIngestErrorFields,
  scrubIngestEventFields,
  scrubIngestSessionUserEmail,
} from "./ingest-pii-scrub.js";

describe("isIngestPiiScrubEnabled", () => {
  it("defaults to enabled", () => {
    expect(isIngestPiiScrubEnabled({})).toBe(true);
  });

  it("can be disabled via env", () => {
    expect(isIngestPiiScrubEnabled({ TELEMETRY_INGEST_PII_SCRUB: "false" })).toBe(
      false
    );
    expect(isIngestPiiScrubEnabled({ TELEMETRY_INGEST_PII_SCRUB: "off" })).toBe(
      false
    );
  });
});

describe("resolveIngestPiiScrubOptions", () => {
  it("parses depth and node limits", () => {
    expect(
      resolveIngestPiiScrubOptions({
        TELEMETRY_INGEST_PII_SCRUB_MAX_DEPTH: "4",
        TELEMETRY_INGEST_PII_SCRUB_MAX_NODES: "50",
      })
    ).toEqual({ maxDepth: 4, maxNodes: 50 });
  });
});

describe("scrubIngestErrorFields", () => {
  const prev = process.env.TELEMETRY_INGEST_PII_SCRUB;

  afterEach(() => {
    if (prev === undefined) delete process.env.TELEMETRY_INGEST_PII_SCRUB;
    else process.env.TELEMETRY_INGEST_PII_SCRUB = prev;
  });

  it("scrubs message, stack, and context before storage", () => {
    const scrubbed = scrubIngestErrorFields(
      {
        message: "boom for user@example.com",
        stack: "Error: user@example.com\n    at run",
        context: { Email: "a@b.co", detail: "token=abc" },
      },
      {}
    );
    expect(scrubbed.message).toBe("boom for [email]");
    expect(scrubbed.stack).toBe("Error: [email]\n    at run");
    expect(scrubbed.context).toEqual({
      Email: "[email]",
      detail: "token=[redacted]",
    });
  });

  it("scrubs before fingerprint so raw emails do not affect grouping", () => {
    const a = scrubIngestErrorFields(
      {
        message: "boom for alice@example.com",
        stack: "Error: alice@example.com\n    at run",
      },
      {}
    );
    const b = scrubIngestErrorFields(
      {
        message: "boom for bob@example.com",
        stack: "Error: bob@example.com\n    at run",
      },
      {}
    );
    expect(computeFingerprint(a.message, a.stack)).toBe(
      computeFingerprint(b.message, b.stack)
    );
    expect(computeFingerprint(a.message, a.stack)).not.toContain("@");
  });

  it("is a no-op when scrubbing is disabled", () => {
    const body = {
      message: "user@example.com",
      context: { email: "a@b.co" },
    };
    expect(
      scrubIngestErrorFields(body, { TELEMETRY_INGEST_PII_SCRUB: "false" })
    ).toEqual(body);
  });
});

describe("scrubIngestEventFields", () => {
  it("scrubs nested properties (shared by /event and /batch)", () => {
    expect(
      scrubIngestEventFields(
        {
          properties: {
            email: "user@example.com",
            meta: { note: "Bearer abc.def" },
          },
        },
        {}
      )
    ).toEqual({
      properties: {
        email: "[email]",
        meta: { note: "[bearer-token]" },
      },
    });
  });

  it("merges project denyKeys into property scrubbing", () => {
    expect(
      scrubIngestEventFields(
        { properties: { nationalId: "X-99", path: "/ok" } },
        {},
        { denyKeys: ["nationalId"] }
      )
    ).toEqual({
      properties: { nationalId: "[redacted]", path: "/ok" },
    });
  });

  it("leaves events without properties unchanged", () => {
    const body = { name: "checkout_started" };
    expect(scrubIngestEventFields(body, {})).toEqual(body);
  });
});

describe("scrubIngestSessionUserEmail", () => {
  it("is a no-op when the project flag is off", () => {
    expect(scrubIngestSessionUserEmail("a@b.co", false, {})).toBe("a@b.co");
  });

  it("stores the stable [email] placeholder when enabled (not null)", () => {
    expect(scrubIngestSessionUserEmail("a@b.co", true, {})).toBe("[email]");
    expect(scrubIngestSessionUserEmail("not-an-email", true, {})).toBe("[email]");
    expect(scrubIngestSessionUserEmail(null, true, {})).toBeNull();
    expect(scrubIngestSessionUserEmail("", true, {})).toBe("");
  });

  it("respects the global ingest kill-switch", () => {
    expect(
      scrubIngestSessionUserEmail("a@b.co", true, {
        TELEMETRY_INGEST_PII_SCRUB: "false",
      })
    ).toBe("a@b.co");
  });
});
