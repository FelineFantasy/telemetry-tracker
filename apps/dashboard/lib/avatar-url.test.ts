import { describe, expect, it } from "vitest";
import { toDashboardAvatarUrl } from "./avatar-url";

describe("toDashboardAvatarUrl", () => {
  it("maps API avatar paths to dashboard proxy routes", () => {
    expect(toDashboardAvatarUrl("/api/auth/avatars/abc?v=1")).toBe("/avatar/abc?v=1");
  });

  it("returns null for missing avatars", () => {
    expect(toDashboardAvatarUrl(null)).toBeNull();
    expect(toDashboardAvatarUrl(undefined)).toBeNull();
  });
});
