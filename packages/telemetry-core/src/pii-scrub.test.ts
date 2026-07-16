import { describe, expect, it } from "vitest";
import { scrubPiiRecord, scrubPiiText } from "./pii-scrub.js";

describe("client scrubPiiText", () => {
  it("redacts emails and preserves newlines", () => {
    expect(scrubPiiText("err user@x.io\n  at f")).toBe("err [email]\n  at f");
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
