import { describe, expect, it } from "vitest";
import { teamInviteNotificationKey } from "./team-notification-keys.js";

describe("teamInviteNotificationKey", () => {
  it("includes invite id and token so re-invites get a fresh read key", () => {
    expect(teamInviteNotificationKey("invite-1", "tok-a")).toBe(
      "team:invite:invite-1:tok-a"
    );
    expect(teamInviteNotificationKey("invite-1", "tok-b")).toBe(
      "team:invite:invite-1:tok-b"
    );
  });
});
