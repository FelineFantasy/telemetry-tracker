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
});
