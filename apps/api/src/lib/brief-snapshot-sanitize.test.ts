import { describe, expect, it } from "vitest";
import { sanitizeBriefText } from "./brief-snapshot-sanitize.js";

describe("sanitizeBriefText", () => {
  it("redacts email addresses", () => {
    expect(sanitizeBriefText("Failed for user@example.com")).toBe(
      "Failed for [email]"
    );
  });

  it("redacts JWT-like tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";
    expect(sanitizeBriefText(`Token ${jwt}`)).toBe("Token [token]");
  });

  it("redacts bearer tokens", () => {
    expect(sanitizeBriefText("Authorization Bearer abc.def-ghi_123")).toContain(
      "[bearer-token]"
    );
  });

  it("redacts API key patterns", () => {
    expect(sanitizeBriefText("key tt_live_abcd0123efgh4567_secretpart")).toContain(
      "[api-key]"
    );
  });

  it("redacts sensitive query parameters in URLs", () => {
    expect(sanitizeBriefText("https://api.example.com/auth?token=abc123")).toBe(
      "https://api.example.com/auth"
    );
  });

  it("redacts standalone sensitive assignments", () => {
    expect(sanitizeBriefText("Failed with token=abc123")).toBe(
      "Failed with token=[redacted]"
    );
  });

  it("redacts cookie and authorization headers", () => {
    expect(sanitizeBriefText("cookie: session=abc123")).toBe("cookie: [cookie]");
    expect(sanitizeBriefText("authorization: Bearer secret")).toBe(
      "authorization: [bearer-token]"
    );
  });

  it("strips non-sensitive URL query strings", () => {
    expect(sanitizeBriefText("GET https://api.example.com/orders?id=123")).toBe(
      "GET https://api.example.com/orders"
    );
  });

  it("redacts UUIDs only in sensitive identifier contexts with stable placeholders", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    const first = sanitizeBriefText(`user_id=${id} and user_id=${id}`);
    const second = sanitizeBriefText(`user_id=${id}`);
    expect(first).toContain("[id:1]");
    expect(second).toContain("[id:1]");
    expect(first.match(/\[id:1\]/g)?.length).toBe(2);
  });

  it("preserves standalone technical UUIDs such as trace IDs", () => {
    const traceId = "b0000000-0000-4000-8000-000000000002";
    expect(sanitizeBriefText(`trace ${traceId}`)).toContain(traceId);
  });

  it("truncates messages to the configured maximum", () => {
    const long = "x".repeat(2500);
    expect(sanitizeBriefText(long).length).toBeLessThanOrEqual(2000);
  });
});
