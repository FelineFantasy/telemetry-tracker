import { describe, expect, it } from "vitest";
import {
  classifyUserCohort,
  cohortIdentityKey,
  cohortSharePct,
  countUserCohorts,
  mergeIdentityFirstSeen,
  assertCohortTotalsMatchDistinctUsers,
} from "./user-cohort.js";

const WINDOW_SINCE = new Date("2026-06-01T00:00:00.000Z");

describe("cohortIdentityKey", () => {
  it("uses anonymous_id when user_id is blank", () => {
    expect(cohortIdentityKey("", "anon-1")).toBe("anon-1");
    expect(cohortIdentityKey("  ", "anon-1")).toBe("anon-1");
  });

  it("prefers user_id after identify()", () => {
    expect(cohortIdentityKey("user-1", "anon-1")).toBe("user-1");
  });

  it("maps linked anonymous activity to user_id for cohort joins", () => {
    const links = new Map([["anon-1", "user-1"]]);
    expect(cohortIdentityKey(null, "anon-1", links)).toBe("user-1");
  });

  it("keeps the same user_id key across apps", () => {
    expect(cohortIdentityKey("user-1", null)).toBe(
      cohortIdentityKey("user-1", "other-anon")
    );
  });
});

describe("classifyUserCohort", () => {
  it("treats first seen on window start as new", () => {
    expect(classifyUserCohort(WINDOW_SINCE, WINDOW_SINCE)).toBe("new");
  });

  it("treats first seen before window start as returning", () => {
    expect(
      classifyUserCohort(new Date("2026-05-15T00:00:00.000Z"), WINDOW_SINCE)
    ).toBe("returning");
  });

  it("treats first seen after window start as new", () => {
    expect(
      classifyUserCohort(new Date("2026-06-02T00:00:00.000Z"), WINDOW_SINCE)
    ).toBe("new");
  });
});

describe("countUserCohorts", () => {
  it("counts anonymous and identified users in the window", () => {
    const counts = countUserCohorts(
      [
        {
          identity: "anon-1",
          firstSeenAt: new Date("2026-06-02T00:00:00.000Z"),
        },
        {
          identity: "user-1",
          firstSeenAt: new Date("2026-05-01T00:00:00.000Z"),
        },
      ],
      WINDOW_SINCE
    );
    expect(counts).toEqual({ newUsers: 1, returningUsers: 1 });
  });

  it("treats pre-identify history as returning when first seen is before the window", () => {
    const counts = countUserCohorts(
      [
        {
          identity: "user-1",
          firstSeenAt: new Date("2026-05-20T00:00:00.000Z"),
        },
      ],
      WINDOW_SINCE
    );
    expect(counts.returningUsers).toBe(1);
  });
});

describe("cohortSharePct", () => {
  it("returns zero when there are no users", () => {
    expect(cohortSharePct(0, 0)).toBe(0);
  });

  it("returns the share of one cohort", () => {
    expect(cohortSharePct(1, 4)).toBe(25);
  });
});

describe("mergeIdentityFirstSeen", () => {
  it("keeps the earliest first-seen when identities collide", () => {
    const merged = mergeIdentityFirstSeen([
      { identity: "user-1", firstSeenAt: new Date("2026-05-01T00:00:00.000Z") },
      { identity: "user-1", firstSeenAt: new Date("2026-06-01T00:00:00.000Z") },
    ]);
    expect(merged.get("user-1")?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("assertCohortTotalsMatchDistinctUsers", () => {
  it("passes when new plus returning equals distinct users", () => {
    expect(
      assertCohortTotalsMatchDistinctUsers(5, { newUsers: 2, returningUsers: 3 })
    ).toBe(true);
  });
});
