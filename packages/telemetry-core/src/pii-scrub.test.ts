import { describe, expect, it } from "vitest";
import { scrubPiiRecord, scrubPiiText, scrubPiiValue } from "./pii-scrub.js";

describe("client scrubPiiText", () => {
  it("redacts emails and preserves newlines", () => {
    expect(scrubPiiText("err user@x.io\n  at f")).toBe("err [email]\n  at f");
  });

  it("redacts Luhn-valid cards and formatted phones", () => {
    expect(scrubPiiText("4111-1111-1111-1111")).toBe("[card]");
    expect(scrubPiiText("4242 4242 4242 4242")).toBe("[card]");
    expect(scrubPiiText("4242-4242-4242-4242")).toBe("[card]");
    expect(scrubPiiText("call +15551234567")).toBe("call [phone]");
    expect(scrubPiiText("+386 40 123 456")).toBe("[phone]");
    expect(scrubPiiText("+1-202-555-0183")).toBe("[phone]");
  });

  it("leaves bare digits and invalid Luhn cards unchanged", () => {
    expect(scrubPiiText("2025550183")).toBe("2025550183");
    expect(scrubPiiText("1234567890")).toBe("1234567890");
    expect(scrubPiiText("4242424242424241")).toBe("4242424242424241");
    expect(scrubPiiText("20260716123000")).toBe("20260716123000");
    expect(scrubPiiText("ref 123.456.7890")).toBe("ref 123.456.7890");
  });

  it("keeps phone and card placeholders stable under a second pass", () => {
    expect(scrubPiiText("[phone]")).toBe("[phone]");
    expect(scrubPiiText("[card]")).toBe("[card]");
  });
});

describe("client scrubPiiRecord", () => {
  it("redacts built-in and denyKeys", () => {
    expect(
      scrubPiiRecord(
        { Email: "a@b.co", nationalId: "X", ok: 1 },
        { denyKeys: ["national_id"] }
      )
    ).toEqual({ Email: "[email]", nationalId: "[redacted]", ok: 1 });
  });
});

describe("client scrubPiiValue traversal limits", () => {
  it("redacts nested PII after maxNodes exhaustion inside objects", () => {
    const payload = {
      metadata: {
        users: [{ email: "person@example.com" }],
      },
    };
    expect(() => scrubPiiValue(payload, { maxNodes: 2 })).not.toThrow();
    const scrubbed = scrubPiiValue(payload, { maxNodes: 2 }) as {
      metadata: { users: Array<{ email: string }> };
    };
    expect(scrubbed.metadata.users[0]?.email).toBe("[email]");
  });

  it("redacts nested PII after maxNodes exhaustion inside arrays", () => {
    const payload = [
      {
        email: "person@example.com",
        token: "secret-token",
      },
    ];
    expect(() => scrubPiiValue(payload, { maxNodes: 1 })).not.toThrow();
    const scrubbed = scrubPiiValue(payload, { maxNodes: 1 }) as Array<{
      email: string;
      token: string;
    }>;
    expect(scrubbed[0]?.email).toBe("[email]");
    expect(scrubbed[0]?.token).toBe("[token]");
  });

  it("redacts nested PII after maxDepth exhaustion", () => {
    const payload = {
      a: {
        b: {
          c: {
            d: {
              token: "secret-token",
              email: "person@example.com",
            },
          },
        },
      },
    };
    expect(() => scrubPiiValue(payload, { maxDepth: 2 })).not.toThrow();
    const scrubbed = scrubPiiValue(payload, { maxDepth: 2 }) as {
      a: { b: { c: { d: { token: string; email: string } } } };
    };
    expect(scrubbed.a.b.c.d.token).toBe("[token]");
    expect(scrubbed.a.b.c.d.email).toBe("[email]");
  });

  it("never returns unvisited nested objects or arrays unchanged", () => {
    const payload = {
      user: {
        profile: {
          email: "person@example.com",
          token: "secret-token",
        },
      },
    };
    const scrubbed = scrubPiiValue(payload, { maxNodes: 1 }) as {
      user: { profile: { email: string; token: string } };
    };
    expect(scrubbed.user.profile.email).toBe("[email]");
    expect(scrubbed.user.profile.token).toBe("[token]");
  });

  it("scrubs deeply nested emails and tokens across a large tree after maxNodes", () => {
    const payload = {
      items: Array.from({ length: 20 }, (_, i) => ({
        id: i,
        payload: { email: `user${i}@example.com`, token: `tok-${i}` },
      })),
    };
    expect(() => scrubPiiValue(payload, { maxNodes: 3 })).not.toThrow();
    const scrubbed = scrubPiiValue(payload, { maxNodes: 3 }) as {
      items: Array<{ payload: { email: string; token: string } }>;
    };
    expect(scrubbed.items[0]?.payload.email).toBe("[email]");
    expect(scrubbed.items[0]?.payload.token).toBe("[token]");
    expect(scrubbed.items[19]?.payload.email).toBe("[email]");
    expect(scrubbed.items[19]?.payload.token).toBe("[token]");
  });

  it("scrubs string leaves in nested objects during the remainder pass", () => {
    const deep = { a: { b: { c: { d: "user@example.com" } } } };
    const scrubbed = scrubPiiValue(deep, { maxDepth: 2 }) as {
      a: { b: { c: { d: string } } };
    };
    expect(scrubbed.a.b.c.d).toBe("[email]");
  });
});
