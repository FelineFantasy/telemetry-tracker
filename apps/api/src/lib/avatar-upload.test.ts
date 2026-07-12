import { describe, expect, it } from "vitest";
import {
  MAX_AVATAR_BYTES,
  buildAvatarApiUrl,
  validateAvatarUpload,
} from "./avatar-upload.js";

/** 1×1 PNG (red pixel). */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("validateAvatarUpload", () => {
  it("accepts a small PNG", () => {
    const result = validateAvatarUpload(PNG_1X1, "image/png");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentType).toBe("image/png");
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    }
  });

  it("rejects empty uploads", () => {
    expect(validateAvatarUpload(Buffer.alloc(0)).ok).toBe(false);
  });

  it("rejects unsupported content types", () => {
    const result = validateAvatarUpload(Buffer.from("not-an-image"), "image/gif");
    expect(result.ok).toBe(false);
  });

  it("rejects files larger than the limit", () => {
    const big = Buffer.alloc(MAX_AVATAR_BYTES + 1, 0xff);
    big[0] = 0x89;
    big[1] = 0x50;
    big[2] = 0x4e;
    big[3] = 0x47;
    const result = validateAvatarUpload(big, "image/png");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/512 KB/i);
    }
  });
});

describe("buildAvatarApiUrl", () => {
  it("returns null without an updated timestamp", () => {
    expect(buildAvatarApiUrl("user-id", null)).toBeNull();
  });

  it("includes cache-busting version query", () => {
    const updatedAt = new Date("2026-07-12T12:00:00.000Z");
    expect(buildAvatarApiUrl("user-id", updatedAt)).toBe(
      `/api/auth/avatars/user-id?v=${updatedAt.getTime()}`
    );
  });
});
