import { describe, expect, it } from "vitest";
import { scrubPiiRecord, scrubPiiText, scrubPiiValue } from "./pii-scrub.js";

describe("scrubPiiText", () => {
  it("redacts email addresses", () => {
    expect(scrubPiiText("Failed for user@example.com")).toBe("Failed for [email]");
  });

  it("redacts JWT-like tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";
    expect(scrubPiiText(`Token ${jwt}`)).toBe("Token [token]");
  });

  it("redacts bearer tokens with a stable placeholder", () => {
    expect(scrubPiiText("Authorization Bearer abc.def-ghi_123")).toContain(
      "[bearer-token]"
    );
  });

  it("redacts API key patterns", () => {
    expect(scrubPiiText("key tt_live_abcd0123efgh4567_secretpart")).toContain(
      "[api-key]"
    );
  });

  it("redacts sensitive query parameters in URLs", () => {
    expect(scrubPiiText("https://api.example.com/auth?token=abc123")).toBe(
      "https://api.example.com/auth"
    );
  });

  it("redacts standalone sensitive assignments", () => {
    expect(scrubPiiText("Failed with token=abc123")).toBe(
      "Failed with token=[redacted]"
    );
  });

  it("redacts cookie and authorization headers", () => {
    expect(scrubPiiText("cookie: session=abc123")).toBe("cookie: [cookie]");
    expect(scrubPiiText("authorization: Bearer secret")).toBe(
      "authorization: [bearer-token]"
    );
  });

  it("strips non-sensitive URL query strings", () => {
    expect(scrubPiiText("GET https://api.example.com/orders?id=123")).toBe(
      "GET https://api.example.com/orders"
    );
  });

  it("redacts UUIDs only in sensitive identifier contexts", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    const first = scrubPiiText(`user_id=${id} and user_id=${id}`);
    expect(first).toContain("[id:1]");
    expect(first.match(/\[id:1\]/g)?.length).toBe(2);
  });

  it("preserves standalone technical UUIDs such as trace IDs", () => {
    const traceId = "b0000000-0000-4000-8000-000000000002";
    expect(scrubPiiText(`trace ${traceId}`)).toContain(traceId);
  });

  it("preserves newlines in stack traces", () => {
    const stack = "Error: boom\n    at foo (app.js:1:1)\n    at bar (app.js:2:2)";
    expect(scrubPiiText(stack)).toContain("\n");
    expect(scrubPiiText(stack).split("\n")).toHaveLength(3);
  });

  it("does not collapse brief-style whitespace (multiple spaces / tabs)", () => {
    expect(scrubPiiText("Error:   boom\t\there")).toBe("Error:   boom\t\there");
  });

  it("leaves non-sensitive messages unchanged", () => {
    expect(scrubPiiText("TypeError: Cannot read property 'x' of undefined")).toBe(
      "TypeError: Cannot read property 'x' of undefined"
    );
  });

  it("redacts emails embedded in stack frames", () => {
    const stack = "Error: mail user@example.com\n    at run (entry.js:10:2)";
    expect(scrubPiiText(stack)).toBe(
      "Error: mail [email]\n    at run (entry.js:10:2)"
    );
  });
});

describe("scrubPiiValue / scrubPiiRecord", () => {
  it("replaces sensitive keys case-insensitively with stable placeholders", () => {
    expect(
      scrubPiiRecord({
        Email: "user@example.com",
        API_KEY: "sk-abcdefghijklmnopqrstuvwxyz",
        authorization: "Bearer abc",
        cookie: "sid=1",
        nested: { phone: "+15551212", safe: "ok" },
      })
    ).toEqual({
      Email: "[email]",
      API_KEY: "[api-key]",
      authorization: "[bearer-token]",
      cookie: "[cookie]",
      nested: { phone: "[phone]", safe: "ok" },
    });
  });

  it("leaves non-sensitive property payloads unchanged", () => {
    const props = {
      path: "/checkout",
      status: 500,
      flags: ["beta", "retry"],
      meta: { attempt: 2, region: "eu" },
    };
    expect(scrubPiiRecord(props)).toEqual(props);
  });

  it("scrubs string values under non-sensitive keys", () => {
    expect(
      scrubPiiRecord({
        note: "contact user@example.com with Bearer abc.def",
        count: 3,
      })
    ).toEqual({
      note: "contact [email] with [bearer-token]",
      count: 3,
    });
  });

  it("walks nested arrays", () => {
    expect(
      scrubPiiValue({
        items: [{ email: "a@b.com" }, { msg: "hi user@x.io" }],
      })
    ).toEqual({
      items: [{ email: "[email]" }, { msg: "hi [email]" }],
    });
  });

  it("stops walking past maxDepth without throwing and still scrubbing shallow leaves", () => {
    const deep = { a: { b: { c: { d: "user@example.com" } } } };
    expect(() => scrubPiiValue(deep, { maxDepth: 2 })).not.toThrow();
    const scrubbed = scrubPiiValue(deep, { maxDepth: 2 }) as {
      a: { b: { c: { d: string } } };
    };
    expect(scrubbed.a.b.c.d).toBe("[email]");
  });

  it("stops walking past maxNodes without throwing", () => {
    const wide: Record<string, string> = {};
    for (let i = 0; i < 20; i += 1) wide[`k${i}`] = `v${i}`;
    expect(() => scrubPiiValue(wide, { maxNodes: 3 })).not.toThrow();
    expect(scrubPiiValue(wide, { maxNodes: 3 })).toMatchObject({ k0: "v0" });
  });
});
