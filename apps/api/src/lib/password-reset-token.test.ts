import { describe, expect, it } from "vitest";
import { hashPasswordResetToken } from "./password-reset-token.js";

describe("hashPasswordResetToken", () => {
  it("returns a stable SHA-256 hex digest", () => {
    const token = "a".repeat(64);
    const hash = hashPasswordResetToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPasswordResetToken(token)).toBe(hash);
  });

  it("differs for different tokens", () => {
    expect(hashPasswordResetToken("token-a")).not.toBe(hashPasswordResetToken("token-b"));
  });
});
