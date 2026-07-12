import { afterEach, describe, expect, it } from "vitest";
import {
  avatarObjectKey,
  getAvatarObject,
  putAvatarObject,
  deleteAvatarObject,
  resetAvatarStorageForTests,
} from "./avatar-storage.js";

/** 1×1 PNG (red pixel). */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("avatar-storage (in-memory fallback)", () => {
  afterEach(() => {
    resetAvatarStorageForTests();
  });

  it("stores and retrieves avatar objects", async () => {
    const key = avatarObjectKey("user-1", "image/png");
    expect(key).toBe("avatars/user-1.png");

    await putAvatarObject(key, PNG_1X1, "image/png");
    const obj = await getAvatarObject(key);
    expect(obj).not.toBeNull();
    expect(obj!.contentType).toBe("image/png");
    expect(obj!.body).toEqual(PNG_1X1);
  });

  it("deletes avatar objects", async () => {
    const key = avatarObjectKey("user-2", "image/jpeg");
    await putAvatarObject(key, PNG_1X1, "image/jpeg");
    await deleteAvatarObject(key);
    expect(await getAvatarObject(key)).toBeNull();
  });

  it("maps content types to file extensions", () => {
    expect(avatarObjectKey("u", "image/jpeg")).toBe("avatars/u.jpg");
    expect(avatarObjectKey("u", "image/webp")).toBe("avatars/u.webp");
  });

  it("throws in production when R2 is not configured", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevR2 = {
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    };
    process.env.NODE_ENV = "production";
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    resetAvatarStorageForTests();

    try {
      await expect(getAvatarObject("avatars/test.png")).rejects.toThrow(
        "Avatar storage is not configured"
      );
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      for (const [key, value] of Object.entries(prevR2)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      resetAvatarStorageForTests();
    }
  });
});
